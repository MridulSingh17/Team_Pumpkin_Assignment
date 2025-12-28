/**
 * Readable Export/Import System for Chat Backups
 * Exports decrypted messages in human-readable JSON format
 * Supports importing backups and merging with existing data
 */

import { localDB } from "./localDB";
import {
  retrieveKeys,
  retrieveDeviceId,
  decryptMultiDeviceMessage,
} from "./encryption";
import { deviceApi } from "./api";
import type { Conversation } from "@/types";

// ==================== TYPES ====================

export interface ReadableExportData {
  version: "2.0.0";
  exportType: "readable-backup";
  exportedAt: string;
  exportedBy: {
    userId: string;
    username: string;
    email: string;
  };
  metadata: {
    totalConversations: number;
    totalMessages: number;
    deviceId: string;
  };
  conversations: ReadableConversation[];
}

export interface ReadableConversation {
  conversationId: string;
  participants: {
    _id: string;
    username: string;
    email: string;
  }[];
  createdAt: string;
  lastMessageAt: string;
  messages: ReadableMessage[];
}

export interface ReadableMessage {
  messageId: string;
  sender: {
    _id: string;
    username: string;
  };
  content: string; // Decrypted content
  timestamp: string;
  isOwn: boolean;
}

export interface ImportSummary {
  success: boolean;
  conversationsImported: number;
  messagesImported: number;
  errors: string[];
}

export interface ExportProgress {
  currentConversation: number;
  totalConversations: number;
  currentMessage: number;
  totalMessages: number;
  status: string;
}

// ==================== EXPORT FUNCTIONS ====================

/**
 * Export all chat data in readable format
 */
export async function exportReadableData(
  currentUserId: string,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ReadableExportData> {
  try {
    // Get user info from localStorage
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      throw new Error("User not found. Please log in again.");
    }

    const user = JSON.parse(userStr);
    const deviceId = retrieveDeviceId();
    const keys = retrieveKeys();

    if (!deviceId || !keys) {
      throw new Error("Encryption keys not found. Please log in again.");
    }

    // Get all conversations from IndexedDB
    const conversations = await localDB.getConversations();

    onProgress?.({
      currentConversation: 0,
      totalConversations: conversations.length,
      currentMessage: 0,
      totalMessages: 0,
      status: "Loading conversations...",
    });

    const readableConversations: ReadableConversation[] = [];
    let totalMessages = 0;

    // Process each conversation
    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];

      onProgress?.({
        currentConversation: i + 1,
        totalConversations: conversations.length,
        currentMessage: 0,
        totalMessages,
        status: `Processing conversation ${i + 1}/${conversations.length}...`,
      });

      // Get messages for this conversation
      const messages = await localDB.getMessages(conversation._id);
      const readableMessages: ReadableMessage[] = [];

      // Decrypt each message
      for (let j = 0; j < messages.length; j++) {
        const message = messages[j];

        try {
          // Try to get cached decrypted content first
          let decryptedContent = await localDB.getDecryptedMessage(message._id);

          // If not cached, decrypt now
          if (!decryptedContent) {
            if (
              message.encryptedVersions &&
              message.encryptedVersions.length > 0
            ) {
              try {
                // Get sender device's public key
                const senderDeviceResponse = await deviceApi.getDevice(
                  message.senderDeviceId,
                );
                if (
                  senderDeviceResponse.success &&
                  senderDeviceResponse.data?.device
                ) {
                  const senderDevicePublicKey =
                    senderDeviceResponse.data.device.publicKey;

                  // Decrypt using ECDH
                  decryptedContent = await decryptMultiDeviceMessage(
                    message.encryptedVersions,
                    deviceId,
                    senderDevicePublicKey,
                  );
                } else {
                  decryptedContent = "[Unable to fetch sender device info]";
                }
              } catch (error) {
                console.error("Failed to decrypt message:", error);
                decryptedContent = "[Unable to decrypt]";
              }
            } else {
              decryptedContent = "[No encrypted content]";
            }
          }

          const senderId =
            typeof message.senderId === "string"
              ? message.senderId
              : message.senderId._id;

          const senderUsername =
            typeof message.senderId === "string"
              ? "Unknown"
              : message.senderId.username;

          readableMessages.push({
            messageId: message._id,
            sender: {
              _id: senderId,
              username: senderUsername,
            },
            content: decryptedContent,
            timestamp: message.timestamp,
            isOwn: senderId === currentUserId,
          });

          totalMessages++;

          onProgress?.({
            currentConversation: i + 1,
            totalConversations: conversations.length,
            currentMessage: j + 1,
            totalMessages,
            status: `Decrypting messages: ${j + 1}/${messages.length}`,
          });
        } catch (error) {
          console.error(`Failed to decrypt message ${message._id}:`, error);
          // Add placeholder for failed decryption
          readableMessages.push({
            messageId: message._id,
            sender: {
              _id:
                typeof message.senderId === "string"
                  ? message.senderId
                  : message.senderId._id,
              username:
                typeof message.senderId === "string"
                  ? "Unknown"
                  : message.senderId.username,
            },
            content: "[Decryption failed]",
            timestamp: message.timestamp,
            isOwn: false,
          });
        }
      }

      // Add conversation to export
      readableConversations.push({
        conversationId: conversation._id,
        participants: conversation.participants.map((p) => ({
          _id: p._id,
          username: p.username,
          email: p.email,
        })),
        createdAt: conversation.createdAt,
        lastMessageAt: conversation.lastMessageAt,
        messages: readableMessages,
      });
    }

    onProgress?.({
      currentConversation: conversations.length,
      totalConversations: conversations.length,
      currentMessage: 0,
      totalMessages,
      status: "Finalizing export...",
    });

    const exportData: ReadableExportData = {
      version: "2.0.0",
      exportType: "readable-backup",
      exportedAt: new Date().toISOString(),
      exportedBy: {
        userId: user._id || user.id,
        username: user.username,
        email: user.email,
      },
      metadata: {
        totalConversations: conversations.length,
        totalMessages,
        deviceId,
      },
      conversations: readableConversations,
    };

    return exportData;
  } catch (error) {
    console.error("Error exporting readable data:", error);
    throw new Error(
      `Failed to export data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Download export data as a JSON file
 */
export function downloadBackupFile(exportData: ReadableExportData): void {
  try {
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `chat-backup-${timestamp}.json`;

    // Trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading backup file:", error);
    throw new Error("Failed to download backup file");
  }
}

/**
 * Get file size in human-readable format
 */
export function getExportFileSize(exportData: ReadableExportData): string {
  const jsonString = JSON.stringify(exportData);
  const bytes = new Blob([jsonString]).size;

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ==================== IMPORT FUNCTIONS ====================

/**
 * Read and parse backup file
 */
export async function readBackupFile(file: File): Promise<ReadableExportData> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate format
    if (
      !data.version ||
      !data.exportType ||
      data.exportType !== "readable-backup"
    ) {
      throw new Error("Invalid backup file format");
    }

    if (data.version !== "2.0.0") {
      throw new Error(`Unsupported backup version: ${data.version}`);
    }

    if (!data.conversations || !Array.isArray(data.conversations)) {
      throw new Error("Invalid backup data: conversations not found");
    }

    return data as ReadableExportData;
  } catch (error) {
    console.error("Error reading backup file:", error);
    throw new Error(
      `Failed to read backup file: ${error instanceof Error ? error.message : "Invalid format"}`,
    );
  }
}

/**
 * Import backup data and merge with existing data
 */
export async function importBackupData(
  exportData: ReadableExportData,
  currentUserId: string,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    success: false,
    conversationsImported: 0,
    messagesImported: 0,
    errors: [],
  };

  try {
    // Get existing conversations
    const existingConversations = await localDB.getConversations();
    const existingConversationIds = new Set(
      existingConversations.map((c) => c._id),
    );

    const totalConversations = exportData.conversations.length;

    for (let i = 0; i < exportData.conversations.length; i++) {
      const importedConv = exportData.conversations[i];

      onProgress?.({
        currentConversation: i + 1,
        totalConversations,
        currentMessage: 0,
        totalMessages: exportData.metadata.totalMessages,
        status: `Importing conversation ${i + 1}/${totalConversations}...`,
      });

      try {
        // Check if conversation already exists
        const conversationExists = existingConversationIds.has(
          importedConv.conversationId,
        );

        if (!conversationExists) {
          // Create new conversation entry
          const newConversation: Conversation = {
            _id: importedConv.conversationId,
            participants: importedConv.participants,
            createdAt: importedConv.createdAt,
            lastMessageAt: importedConv.lastMessageAt,
          };

          await localDB.saveConversation(newConversation);
          summary.conversationsImported++;
        }

        // Get existing messages for this conversation
        const existingMessages = await localDB.getMessages(
          importedConv.conversationId,
        );
        const existingMessageIds = new Set(existingMessages.map((m) => m._id));

        // Import messages
        for (let j = 0; j < importedConv.messages.length; j++) {
          const importedMsg = importedConv.messages[j];

          try {
            // Skip if message already exists
            if (existingMessageIds.has(importedMsg.messageId)) {
              continue;
            }

            // Store imported message (without encryption data)
            // We'll create a simplified message structure for imported data
            await localDB.saveImportedMessage({
              _id: importedMsg.messageId,
              conversationId: importedConv.conversationId,
              senderId: importedMsg.sender._id,
              senderUsername: importedMsg.sender.username,
              content: importedMsg.content,
              timestamp: importedMsg.timestamp,
              isImported: true,
            });

            // Cache the decrypted content
            await localDB.saveDecryptedMessage(
              importedMsg.messageId,
              importedMsg.content,
            );

            summary.messagesImported++;

            onProgress?.({
              currentConversation: i + 1,
              totalConversations,
              currentMessage: j + 1,
              totalMessages: exportData.metadata.totalMessages,
              status: `Importing messages: ${j + 1}/${importedConv.messages.length}`,
            });
          } catch (error) {
            console.error(
              `Failed to import message ${importedMsg.messageId}:`,
              error,
            );
            summary.errors.push(
              `Message ${importedMsg.messageId}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }
      } catch (error) {
        console.error(
          `Failed to import conversation ${importedConv.conversationId}:`,
          error,
        );
        summary.errors.push(
          `Conversation ${importedConv.conversationId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    summary.success = true;
    return summary;
  } catch (error) {
    console.error("Error importing backup data:", error);
    summary.errors.push(
      `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return summary;
  }
}

/**
 * Validate backup file before import
 */
export function validateBackupData(exportData: ReadableExportData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!exportData.version) {
    errors.push("Missing version field");
  }

  if (exportData.version !== "2.0.0") {
    errors.push(`Unsupported version: ${exportData.version}`);
  }

  if (!exportData.exportType || exportData.exportType !== "readable-backup") {
    errors.push("Invalid export type");
  }

  if (!exportData.conversations || !Array.isArray(exportData.conversations)) {
    errors.push("Invalid or missing conversations data");
  }

  if (!exportData.metadata) {
    errors.push("Missing metadata");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
