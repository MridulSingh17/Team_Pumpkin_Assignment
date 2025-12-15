/**
 * Readable Export/Import System for Chat Backups (Mobile)
 * Exports decrypted messages in human-readable JSON format
 * Supports importing backups and merging with existing data
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    retrieveKeys,
    retrieveDeviceId,
    decryptMessageFromDevices,
} from "./encryption";
import type { Conversation, Message } from "@/types";

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

export interface ImportedMessage {
    _id: string;
    conversationId: string;
    senderId: string;
    senderUsername: string;
    content: string;
    timestamp: string;
    isImported: boolean;
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
    onProgress?: (progress: ExportProgress) => void
): Promise<ReadableExportData> {
    try {
        // Get user info from AsyncStorage
        const userStr = await AsyncStorage.getItem("user");
        if (!userStr) {
            throw new Error("User not found. Please log in again.");
        }

        const user = JSON.parse(userStr);
        const deviceId = await retrieveDeviceId();
        const keys = await retrieveKeys();

        if (!deviceId || !keys) {
            throw new Error("Encryption keys not found. Please log in again.");
        }

        // Get all conversations from AsyncStorage
        const conversationsStr = await AsyncStorage.getItem("conversations");
        const conversations: Conversation[] = conversationsStr
            ? JSON.parse(conversationsStr)
            : [];

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
                status: `Processing conversation ${i + 1}/${
                    conversations.length
                }...`,
            });

            // Get messages for this conversation (both regular and imported)
            const messagesStr = await AsyncStorage.getItem(
                `messages_${conversation._id}`
            );
            const messages: Message[] = messagesStr
                ? JSON.parse(messagesStr)
                : [];

            // Get imported messages for this conversation
            const importedMessagesStr = await AsyncStorage.getItem(
                `imported_messages_${conversation._id}`
            );
            const importedMessages: ImportedMessage[] = importedMessagesStr
                ? JSON.parse(importedMessagesStr)
                : [];

            console.log(
                `Exporting conversation ${conversation._id}: ${messages.length} regular messages + ${importedMessages.length} imported messages`
            );

            const readableMessages: ReadableMessage[] = [];

            // Decrypt each regular message
            for (let j = 0; j < messages.length; j++) {
                const message = messages[j];

                try {
                    // Try to get cached decrypted content first
                    const cacheKey = `decrypted_${message._id}`;
                    let decryptedContent = await AsyncStorage.getItem(cacheKey);

                    // If not cached, decrypt now
                    if (!decryptedContent) {
                        const senderId =
                            typeof message.senderId === "string"
                                ? message.senderId
                                : message.senderId._id;

                        const isSender = senderId === currentUserId;
                        const encryptedVersions = isSender
                            ? message.senderEncryptedVersions
                            : message.recipientEncryptedVersions;

                        if (encryptedVersions && encryptedVersions.length > 0) {
                            decryptedContent = await decryptMessageFromDevices(
                                encryptedVersions,
                                deviceId,
                                keys.privateKey
                            );
                        } else {
                            decryptedContent = "[Unable to decrypt]";
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
                        status: `Decrypting messages: ${j + 1}/${
                            messages.length
                        }`,
                    });
                } catch (error) {
                    console.error(
                        `Failed to decrypt message ${message._id}:`,
                        error
                    );
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

            // Add imported messages (already decrypted)
            for (const importedMsg of importedMessages) {
                readableMessages.push({
                    messageId: importedMsg._id,
                    sender: {
                        _id: importedMsg.senderId,
                        username: importedMsg.senderUsername,
                    },
                    content: importedMsg.content,
                    timestamp: importedMsg.timestamp,
                    isOwn: importedMsg.senderId === currentUserId,
                });
                totalMessages++;
            }

            // Sort messages by timestamp
            readableMessages.sort(
                (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime()
            );

            console.log(
                `Total messages for conversation ${conversation._id}: ${readableMessages.length}`
            );

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
            `Failed to export data: ${
                error instanceof Error ? error.message : "Unknown error"
            }`
        );
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
export async function readBackupFile(
    fileContent: string
): Promise<ReadableExportData> {
    try {
        const data = JSON.parse(fileContent);

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
            `Failed to read backup file: ${
                error instanceof Error ? error.message : "Invalid format"
            }`
        );
    }
}

/**
 * Import backup data and merge with existing data
 */
export async function importBackupData(
    exportData: ReadableExportData,
    currentUserId: string,
    onProgress?: (progress: ExportProgress) => void
): Promise<ImportSummary> {
    console.log("🚀 Starting import process...");
    console.log(
        `📊 Import data: ${exportData.metadata.totalConversations} conversations, ${exportData.metadata.totalMessages} messages`
    );

    const summary: ImportSummary = {
        success: false,
        conversationsImported: 0,
        messagesImported: 0,
        errors: [],
    };

    try {
        // Get existing conversations
        const conversationsStr = await AsyncStorage.getItem("conversations");
        const existingConversations: Conversation[] = conversationsStr
            ? JSON.parse(conversationsStr)
            : [];
        const existingConversationIds = new Set(
            existingConversations.map((c) => c._id)
        );

        const totalConversations = exportData.conversations.length;

        for (let i = 0; i < exportData.conversations.length; i++) {
            const importedConv = exportData.conversations[i];

            onProgress?.({
                currentConversation: i + 1,
                totalConversations,
                currentMessage: 0,
                totalMessages: exportData.metadata.totalMessages,
                status: `Importing conversation ${
                    i + 1
                }/${totalConversations}...`,
            });

            try {
                // Check if conversation already exists
                const conversationExists = existingConversationIds.has(
                    importedConv.conversationId
                );

                if (!conversationExists) {
                    // Create new conversation entry
                    const newConversation: Conversation = {
                        _id: importedConv.conversationId,
                        participants: importedConv.participants.map((p) => ({
                            ...p,
                            publicKey: "", // Imported conversations may not have publicKey
                        })),
                        createdAt: importedConv.createdAt,
                        lastMessageAt: importedConv.lastMessageAt,
                    };

                    existingConversations.push(newConversation);
                    summary.conversationsImported++;
                }

                // Get existing messages for this conversation
                const messagesStr = await AsyncStorage.getItem(
                    `messages_${importedConv.conversationId}`
                );
                const existingMessages: Message[] = messagesStr
                    ? JSON.parse(messagesStr)
                    : [];
                const existingMessageIds = new Set(
                    existingMessages.map((m) => m._id)
                );

                console.log(
                    `📦 Checking existing data for conversation ${importedConv.conversationId}:`
                );
                console.log(
                    `   - Regular messages in AsyncStorage: ${existingMessages.length}`
                );

                // Get existing imported messages
                const importedMessagesStr = await AsyncStorage.getItem(
                    `imported_messages_${importedConv.conversationId}`
                );
                const existingImportedMessages: ImportedMessage[] =
                    importedMessagesStr ? JSON.parse(importedMessagesStr) : [];
                const existingImportedMessageIds = new Set(
                    existingImportedMessages.map((m) => m._id)
                );

                console.log(
                    `Processing ${importedConv.messages.length} messages for conversation ${importedConv.conversationId}`
                );
                console.log(
                    `Existing regular messages: ${existingMessages.length}, Existing imported messages: ${existingImportedMessages.length}`
                );

                // Import messages
                for (let j = 0; j < importedConv.messages.length; j++) {
                    const importedMsg = importedConv.messages[j];

                    try {
                        // Skip if message already exists in regular messages or imported messages
                        if (
                            existingMessageIds.has(importedMsg.messageId) ||
                            existingImportedMessageIds.has(
                                importedMsg.messageId
                            )
                        ) {
                            console.log(
                                `⚠️ Skipping message ${
                                    importedMsg.messageId
                                } - already exists (in ${
                                    existingMessageIds.has(
                                        importedMsg.messageId
                                    )
                                        ? "regular"
                                        : "imported"
                                } messages)`
                            );
                            continue;
                        }

                        console.log(
                            `✅ Importing new message ${importedMsg.messageId}: "${importedMsg.content}"`
                        );

                        // Store imported message
                        const importedMessage: ImportedMessage = {
                            _id: importedMsg.messageId,
                            conversationId: importedConv.conversationId,
                            senderId: importedMsg.sender._id,
                            senderUsername: importedMsg.sender.username,
                            content: importedMsg.content,
                            timestamp: importedMsg.timestamp,
                            isImported: true,
                        };

                        existingImportedMessages.push(importedMessage);

                        // Cache the decrypted content
                        await AsyncStorage.setItem(
                            `decrypted_${importedMsg.messageId}`,
                            importedMsg.content
                        );

                        summary.messagesImported++;

                        onProgress?.({
                            currentConversation: i + 1,
                            totalConversations,
                            currentMessage: j + 1,
                            totalMessages: exportData.metadata.totalMessages,
                            status: `Importing messages: ${j + 1}/${
                                importedConv.messages.length
                            }`,
                        });
                    } catch (error) {
                        console.error(
                            `Failed to import message ${importedMsg.messageId}:`,
                            error
                        );
                        summary.errors.push(
                            `Message ${importedMsg.messageId}: ${
                                error instanceof Error
                                    ? error.message
                                    : "Unknown error"
                            }`
                        );
                    }
                }

                // Save imported messages
                await AsyncStorage.setItem(
                    `imported_messages_${importedConv.conversationId}`,
                    JSON.stringify(existingImportedMessages)
                );

                console.log(
                    `Saved ${existingImportedMessages.length} imported messages for conversation ${importedConv.conversationId}`
                );
            } catch (error) {
                console.error(
                    `Failed to import conversation ${importedConv.conversationId}:`,
                    error
                );
                summary.errors.push(
                    `Conversation ${importedConv.conversationId}: ${
                        error instanceof Error ? error.message : "Unknown error"
                    }`
                );
            }
        }

        // Save updated conversations
        await AsyncStorage.setItem(
            "conversations",
            JSON.stringify(existingConversations)
        );

        summary.success = true;
        return summary;
    } catch (error) {
        console.error("Error importing backup data:", error);
        summary.errors.push(
            `Import failed: ${
                error instanceof Error ? error.message : "Unknown error"
            }`
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
