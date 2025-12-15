import { Request, Response } from 'express';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import crypto from 'crypto';

/**
 * Export conversation messages
 * POST /api/export
 */
export const exportConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId, backupKey } = req.body;
    const currentUserId = req.userId;

    // Validate required fields
    if (!conversationId || !backupKey) {
      res.status(400).json({
        success: false,
        message: 'Conversation ID and backup key are required'
      });
      return;
    }

    // Check if conversation exists
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'username email');

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
      return;
    }

    // Check if user is a participant in the conversation
    const isParticipant = conversation.participants.some(
      (participant: any) => participant._id.toString() === currentUserId?.toString()
    );

    if (!isParticipant) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to export this conversation'
      });
      return;
    }

    // Get all messages from the conversation
    const messages = await Message.find({ conversationId })
      .sort({ timestamp: 1 })
      .populate('senderId', 'username email')
      .lean();

    // Prepare export data
    const exportData = {
      conversationId: conversation._id,
      participants: conversation.participants,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map(msg => ({
        _id: msg._id,
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        senderDeviceId: msg.senderDeviceId,
        senderEncryptedVersions: msg.senderEncryptedVersions,
        recipientEncryptedVersions: msg.recipientEncryptedVersions,
        timestamp: msg.timestamp
      }))
    };

    // Convert to JSON string
    const dataString = JSON.stringify(exportData);

    // Encrypt the export data with backup key
    // Using AES-256-CBC encryption
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(backupKey).digest();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Combine IV and encrypted data
    const encryptedData = iv.toString('hex') + ':' + encrypted;

    res.status(200).json({
      success: true,
      message: 'Conversation exported successfully',
      data: {
        encryptedData,
        conversationId: conversation._id,
        messageCount: messages.length,
        exportedAt: exportData.exportedAt
      }
    });
  } catch (error) {
    console.error('Export conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting conversation',
      error: (error as Error).message
    });
  }
};

/**
 * Import conversation messages
 * POST /api/import
 */
export const importConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { encryptedData, backupKey } = req.body;
    const currentUserId = req.userId;

    // Validate required fields
    if (!encryptedData || !backupKey) {
      res.status(400).json({
        success: false,
        message: 'Encrypted data and backup key are required'
      });
      return;
    }

    // Decrypt the import data
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.createHash('sha256').update(backupKey).digest();

      // Split IV and encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const importData = JSON.parse(decrypted);

      // Validate import data structure
      if (!importData.conversationId || !importData.messages || !Array.isArray(importData.messages)) {
        res.status(400).json({
          success: false,
          message: 'Invalid import data structure'
        });
        return;
      }

      // Check if conversation exists
      const conversation = await Conversation.findById(importData.conversationId);

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
        return;
      }

      // Check if user is a participant in the conversation
      const isParticipant = conversation.participants.some(
        (participant) => participant.toString() === currentUserId?.toString()
      );

      if (!isParticipant) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to import to this conversation'
        });
        return;
      }

      // Import messages (skip duplicates based on _id)
      let importedCount = 0;
      let skippedCount = 0;

      for (const msgData of importData.messages) {
        // Check if message already exists
        const existingMessage = await Message.findById(msgData._id);

        if (!existingMessage) {
          // Create new message with original data
          await Message.create({
            _id: msgData._id,
            conversationId: msgData.conversationId || importData.conversationId,
            senderId: msgData.senderId._id || msgData.senderId,
            recipientId: msgData.recipientId,
            senderDeviceId: msgData.senderDeviceId,
            senderEncryptedVersions: msgData.senderEncryptedVersions || [],
            recipientEncryptedVersions: msgData.recipientEncryptedVersions || [],
            timestamp: msgData.timestamp
          });
          importedCount++;
        } else {
          skippedCount++;
        }
      }

      // Update conversation's lastMessageAt if messages were imported
      if (importedCount > 0) {
        const lastMessage = await Message.findOne({ conversationId: importData.conversationId })
          .sort({ timestamp: -1 });

        if (lastMessage) {
          conversation.lastMessageAt = lastMessage.timestamp;
          await conversation.save();
        }
      }

      res.status(200).json({
        success: true,
        message: 'Conversation imported successfully',
        data: {
          conversationId: importData.conversationId,
          totalMessages: importData.messages.length,
          importedCount,
          skippedCount,
          importedAt: new Date().toISOString()
        }
      });
    } catch (decryptError) {
      res.status(400).json({
        success: false,
        message: 'Failed to decrypt import data. Please check your backup key.',
        error: (decryptError as Error).message
      });
      return;
    }
  } catch (error) {
    console.error('Import conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing conversation',
      error: (error as Error).message
    });
  }
};