import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import User from '../models/User';

/**
 * Create a new conversation
 * POST /api/conversations
 */
export const createConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { participantId } = req.body;
    const currentUserId = req.userId;

    // Validate participantId
    if (!participantId) {
      res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
      return;
    }

    // Check if trying to create conversation with self
    if (participantId === currentUserId?.toString()) {
      res.status(400).json({
        success: false,
        message: 'Cannot create conversation with yourself'
      });
      return;
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
      return;
    }

    // Check if conversation already exists
    let existingConversation = await Conversation.findOne({
      participants: { $all: [currentUserId, participantId] }
    });

    if (existingConversation) {
      // Populate participants data
      await existingConversation.populate('participants', 'username email publicKey');

      res.status(200).json({
        success: true,
        message: 'Conversation already exists',
        data: {
          conversation: existingConversation
        }
      });
      return;
    }

    // Create new conversation
    const conversation = await Conversation.create({
      participants: [currentUserId, participantId]
    });

    // Populate participants data
    await conversation.populate('participants', 'username email publicKey');

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: {
        conversation
      }
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating conversation',
      error: (error as Error).message
    });
  }
};

/**
 * Get all conversations for the logged-in user
 * GET /api/conversations
 */
export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUserId = req.userId;

    // Find all conversations where user is a participant
    const conversations = await Conversation.find({
      participants: currentUserId
    })
      .populate('participants', 'username email publicKey')
      .sort({ lastMessageAt: -1 })
      .lean();

    // Get last message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conversation) => {
        const lastMessage = await Message.findOne({
          conversationId: conversation._id
        })
          .sort({ timestamp: -1 })
          .populate('senderId', 'username')
          .lean();

        return {
          ...conversation,
          lastMessage: lastMessage || null
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        conversations: conversationsWithLastMessage
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: (error as Error).message
    });
  }
};

/**
 * Get specific conversation details
 * GET /api/conversations/:conversationId
 */
export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.userId;

    // Find conversation
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'username email publicKey');

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
      return;
    }

    // Check if current user is a participant
    const isParticipant = conversation.participants.some(
      (participant: any) => participant._id.toString() === currentUserId?.toString()
    );

    if (!isParticipant) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to access this conversation'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        conversation
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching conversation',
      error: (error as Error).message
    });
  }
};

/**
 * Get or create conversation with a user
 * POST /api/conversations/get-or-create
 */
export const getOrCreateConversation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { participantId } = req.body;
    const currentUserId = req.userId;

    // Validate participantId
    if (!participantId) {
      res.status(400).json({
        success: false,
        message: "Participant ID is required",
      });
      return;
    }

    // Check if trying to create conversation with self
    if (participantId === currentUserId?.toString()) {
      res.status(400).json({
        success: false,
        message: "Cannot create conversation with yourself",
      });
      return;
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      res.status(404).json({
        success: false,
        message: "Participant not found",
      });
      return;
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, participantId] },
    });

    let isNew = false;

    // If conversation doesn't exist, create it
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, participantId],
      });
      isNew = true;
    }

    // Populate participants data
    await conversation.populate("participants", "username email publicKey");

    res.status(200).json({
      success: true,
      message: isNew
        ? "Conversation created successfully"
        : "Conversation retrieved successfully",
      data: {
        conversation,
        isNew,
      },
    });
  } catch (error) {
    console.error("Get or create conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting or creating conversation",
      error: (error as Error).message,
    });
  }
};