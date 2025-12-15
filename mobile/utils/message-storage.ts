import AsyncStorage from "@react-native-async-storage/async-storage";
import { Message } from "@/services/mock-api";

/**
 * Utility functions for managing messages in local storage
 */

export interface ImportedMessage {
    _id: string;
    conversationId: string;
    senderId: string;
    senderUsername: string;
    content: string;
    timestamp: string;
    isImported: boolean;
}

/**
 * Get messages for a specific QR code data
 * @param qrData - The QR code data used as the key
 * @returns Promise<Message[]> - Array of messages
 */
export async function getMessagesForQRData(qrData: string): Promise<Message[]> {
    try {
        const key = `messages_${qrData}`;
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error("Error getting messages:", error);
        return [];
    }
}

/**
 * Save messages for a specific QR code data
 * @param qrData - The QR code data used as the key
 * @param messages - Array of messages to save
 */
export async function saveMessagesForQRData(
    qrData: string,
    messages: Message[]
): Promise<void> {
    try {
        const key = `messages_${qrData}`;
        await AsyncStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
        console.error("Error saving messages:", error);
        throw error;
    }
}

/**
 * Delete messages for a specific QR code data
 * @param qrData - The QR code data used as the key
 */
export async function deleteMessagesForQRData(qrData: string): Promise<void> {
    try {
        const key = `messages_${qrData}`;
        await AsyncStorage.removeItem(key);
    } catch (error) {
        console.error("Error deleting messages:", error);
        throw error;
    }
}

/**
 * Get all message keys stored in AsyncStorage
 * @returns Promise<string[]> - Array of QR data keys
 */
export async function getAllMessageKeys(): Promise<string[]> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        return allKeys.filter((key) => key.startsWith("messages_"));
    } catch (error) {
        console.error("Error getting all message keys:", error);
        return [];
    }
}

/**
 * Clear all messages from storage
 */
export async function clearAllMessages(): Promise<void> {
    try {
        const messageKeys = await getAllMessageKeys();
        await AsyncStorage.multiRemove(messageKeys);
    } catch (error) {
        console.error("Error clearing all messages:", error);
        throw error;
    }
}

/**
 * Mark a message as read
 * @param qrData - The QR code data
 * @param messageId - The ID of the message to mark as read
 */
export async function markMessageAsRead(
    qrData: string,
    messageId: string
): Promise<void> {
    try {
        const messages = await getMessagesForQRData(qrData);
        const updatedMessages = messages.map((msg) =>
            msg.id === messageId ? { ...msg, read: true } : msg
        );
        await saveMessagesForQRData(qrData, updatedMessages);
    } catch (error) {
        console.error("Error marking message as read:", error);
        throw error;
    }
}

// ==================== IMPORTED MESSAGES ====================

/**
 * Save an imported message
 */
export async function saveImportedMessage(
    message: ImportedMessage
): Promise<void> {
    try {
        const key = `imported_messages_${message.conversationId}`;
        const existing = await getImportedMessages(message.conversationId);
        const updated = [...existing, message];
        await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
        console.error("Error saving imported message:", error);
        throw error;
    }
}

/**
 * Get imported messages for a conversation
 */
export async function getImportedMessages(
    conversationId: string
): Promise<ImportedMessage[]> {
    try {
        const key = `imported_messages_${conversationId}`;
        const data = await AsyncStorage.getItem(key);
        const messages = data ? JSON.parse(data) : [];
        console.log(
            `getImportedMessages for ${conversationId}: found ${messages.length} messages`
        );
        return messages;
    } catch (error) {
        console.error("Error getting imported messages:", error);
        return [];
    }
}

/**
 * Get all imported messages
 */
export async function getAllImportedMessages(): Promise<ImportedMessage[]> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const importedKeys = allKeys.filter((key) =>
            key.startsWith("imported_messages_")
        );
        const allMessages: ImportedMessage[] = [];

        for (const key of importedKeys) {
            const data = await AsyncStorage.getItem(key);
            if (data) {
                const messages = JSON.parse(data);
                allMessages.push(...messages);
            }
        }

        return allMessages;
    } catch (error) {
        console.error("Error getting all imported messages:", error);
        return [];
    }
}

/**
 * Clear imported messages for a conversation
 */
export async function clearImportedMessages(
    conversationId: string
): Promise<void> {
    try {
        const key = `imported_messages_${conversationId}`;
        await AsyncStorage.removeItem(key);
    } catch (error) {
        console.error("Error clearing imported messages:", error);
        throw error;
    }
}

/**
 * Clear all imported messages
 */
export async function clearAllImportedMessages(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const importedKeys = allKeys.filter((key) =>
            key.startsWith("imported_messages_")
        );
        await AsyncStorage.multiRemove(importedKeys);
    } catch (error) {
        console.error("Error clearing all imported messages:", error);
        throw error;
    }
}
