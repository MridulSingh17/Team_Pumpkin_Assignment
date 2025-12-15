import { Request, Response } from "express";
import Message from "../models/Message";
import Conversation from "../models/Conversation";
import Device from "../models/Device";

/**
 * Send a new message
 * POST /api/messages
 */
export const sendMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      conversationId,
      senderDeviceId,
      senderEncryptedVersions,
      recipientEncryptedVersions,
    } = req.body;
    const senderId = req.userId;

    // Validate required fields
    if (!conversationId) {
      res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
      return;
    }

    if (!senderDeviceId) {
      res.status(400).json({
        success: false,
        message: "Sender device ID is required",
      });
      return;
    }

    if (!Array.isArray(senderEncryptedVersions) || senderEncryptedVersions.length === 0) {
      res.status(400).json({
        success: false,
        message: "Sender encrypted versions must be a non-empty array",
      });
      return;
    }

    if (!Array.isArray(recipientEncryptedVersions) || recipientEncryptedVersions.length === 0) {
      res.status(400).json({
        success: false,
        message: "Recipient encrypted versions must be a non-empty array",
      });
      return;
    }

    // Validate structure of encrypted versions
    const validateVersions = (versions: any[], name: string) => {
      for (const version of versions) {
        if (!version.deviceId || !version.encryptedContent) {
          res.status(400).json({
            success: false,
            message: `Invalid ${name}: each version must have deviceId and encryptedContent`,
          });
          return false;
        }
      }
      return true;
    };

    if (!validateVersions(senderEncryptedVersions, "sender encrypted versions")) {
      return;
    }

    if (!validateVersions(recipientEncryptedVersions, "recipient encrypted versions")) {
      return;
    }

    // Verify sender device belongs to sender
    const senderDevice = await Device.findOne({
      _id: senderDeviceId,
      userId: senderId,
      isActive: true,
    });

    if (!senderDevice) {
      res.status(403).json({
        success: false,
        message: "Invalid sender device or device is inactive",
      });
      return;
    }

    // Check if conversation exists
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
      return;
    }

    // Check if user is a participant in the conversation
    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === senderId?.toString(),
    );

    if (!isParticipant) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to send messages in this conversation",
      });
      return;
    }

    // Determine recipient ID from conversation participants
    const recipientId = conversation.participants.find(
      (p) => p.toString() !== senderId?.toString()
    );

    // Create new message with multi-device encryption
    const messageData: any = {
      conversationId,
      senderId,
      recipientId,
      senderDeviceId,
      senderEncryptedVersions,
      recipientEncryptedVersions,
    };

    const createdMessage = await Message.create(messageData);
    const message = Array.isArray(createdMessage)
      ? createdMessage[0]
      : createdMessage;


    // Update conversation's lastMessageAt
    conversation.lastMessageAt = message.timestamp;
    await conversation.save();

    // Populate sender info
    await message.populate("senderId", "username email");

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: {
        message,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending message",
      error: (error as Error).message,
    });
  }
};

/**
 * Get messages for a conversation with pagination
 * GET /api/messages/:conversationId?page=1&limit=50
 */
export const getMessages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.userId;

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;



    // Check if conversation exists
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
      return;
    }

    // Check if user is a participant in the conversation
    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === currentUserId?.toString(),
    );

    if (!isParticipant) {
      res.status(403).json({
        success: false,
        message:
          "You are not authorized to access messages in this conversation",
      });
      return;
    }

    // Get current user's device ID from query parameter
    const deviceId = req.query.deviceId as string | undefined;

    if (!deviceId) {
      res.status(400).json({
        success: false,
        message: "Device ID is required",
      });
      return;
    }

    // Build query filter
    const messageFilter: any = {
      conversationId,
      $or: [
        { 'senderEncryptedVersions.deviceId': deviceId },
        { 'recipientEncryptedVersions.deviceId': deviceId }
      ]
    };

    // Get total count of messages
    const totalMessages = await Message.countDocuments(messageFilter);

    // Get messages with pagination
    const messages = await Message.find(messageFilter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "username email")
      .lean();



    // Calculate pagination info
    const totalPages = Math.ceil(totalMessages / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          currentPage: page,
          totalPages,
          totalMessages,
          limit,
          hasNextPage,
          hasPrevPage,
        },
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching messages",
      error: (error as Error).message,
    });
  }
};
