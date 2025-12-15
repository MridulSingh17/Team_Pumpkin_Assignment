import { Server, Socket } from "socket.io";
import Message from "../models/Message";
import Conversation from "../models/Conversation";
import Device from "../models/Device";
import { ISendMessageData, ISocketCallback } from "../types/interfaces";
import { verifyAccessToken } from "./tokenUtils";

// Extend Socket interface to include userId
interface AuthSocket extends Socket {
  userId: string;
}

// Store active socket connections: userId -> socketId
const activeUsers = new Map<string, string>();

/**
 * Initialize Socket.io
 * @param {Server} io - Socket.io server instance
 */
export const initializeSocket = (io: Server): Server => {
  // Middleware for socket authentication
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Verify token using new token utilities
      const decoded = verifyAccessToken(token);

      if (!decoded) {
        return next(new Error("Invalid or expired token"));
      }

      (socket as AuthSocket).userId = decoded.userId;

      return next();
    } catch (error) {
      return next(new Error("Invalid or expired token"));
    }
  });

  // Handle socket connections
  io.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthSocket;

    // Store active user connection
    activeUsers.set(authSocket.userId, socket.id);

    // Join user to their own room for private messaging
    socket.join(authSocket.userId);

    // Handle sending messages
    socket.on(
      "send_message",
      async (
        data: ISendMessageData,
        callback?: (response: ISocketCallback) => void,
      ) => {
        try {
          const {
            conversationId,
            senderDeviceId,
            senderEncryptedVersions,
            recipientEncryptedVersions,
          } = data;
          const senderId = authSocket.userId;

          // Validate data
          if (!conversationId) {
            if (callback) {
              callback({
                success: false,
                message: "Conversation ID is required",
              });
            }
            return;
          }

          if (!senderDeviceId) {
            if (callback) {
              callback({
                success: false,
                message: "Sender device ID is required",
              });
            }
            return;
          }

          if (!Array.isArray(senderEncryptedVersions) || senderEncryptedVersions.length === 0) {
            if (callback) {
              callback({
                success: false,
                message: "Sender encrypted versions must be a non-empty array",
              });
            }
            return;
          }

          if (!Array.isArray(recipientEncryptedVersions) || recipientEncryptedVersions.length === 0) {
            if (callback) {
              callback({
                success: false,
                message: "Recipient encrypted versions must be a non-empty array",
              });
            }
            return;
          }

          // Validate structure of encrypted versions
          const validateVersions = (versions: any[], name: string) => {
            for (const version of versions) {
              if (!version.deviceId || !version.encryptedContent) {
                if (callback) {
                  callback({
                    success: false,
                    message: `Invalid ${name}: each version must have deviceId and encryptedContent`,
                  });
                }
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
            if (callback) {
              callback({
                success: false,
                message: "Invalid sender device or device is inactive",
              });
            }
            return;
          }

          // Check if conversation exists
          const conversation = await Conversation.findById(conversationId);

          if (!conversation) {
            if (callback) {
              callback({
                success: false,
                message: "Conversation not found",
              });
            }
            return;
          }

          // Check if user is a participant
          const isParticipant = conversation.participants.some(
            (participant) => participant.toString() === senderId,
          );

          if (!isParticipant) {
            if (callback) {
              callback({
                success: false,
                message:
                  "You are not authorized to send messages in this conversation",
              });
            }
            return;
          }

          // Determine recipient ID from conversation participants
          const recipientId = conversation.participants.find(
            (participant) => participant.toString() !== senderId,
          );

          // Create message with multi-device encryption
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

          // Emit message to recipient if they're online
          if (recipientId) {
            io.to(recipientId.toString()).emit("new_message", {
              message: message.toObject(),
            });
          }

          // Send acknowledgment back to sender
          if (callback) {
            callback({
              success: true,
              message: "Message sent successfully",
              data: {
                message: message.toObject(),
              },
            });
          }

          // Also emit to sender for confirmation
          socket.emit("new_message", {
            message: message.toObject(),
          });
        } catch (error) {
          console.error("Send message error:", error);
          if (callback) {
            callback({
              success: false,
              message: "Error sending message",
              error: (error as Error).message,
            });
          }
        }
      },
    );

    // Handle disconnection
    socket.on("disconnect", () => {
      activeUsers.delete(authSocket.userId);
    });

    // Handle errors
    socket.on("error", (error: Error) => {
      console.error("Socket error:", error);
    });
  });

  return io;
};

/**
 * Get active users
 * @returns {Map} Map of active users
 */
export const getActiveUsers = (): Map<string, string> => {
  return activeUsers;
};

/**
 * Check if user is online
 * @param {String} userId - User ID to check
 * @returns {Boolean}
 */
export const isUserOnline = (userId: string): boolean => {
  return activeUsers.has(userId);
};
