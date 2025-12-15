/**
 * Data export/import utilities for QR code transfer
 * Handles exporting and importing all chat data, keys, and tokens
 */

import { localDB } from './localDB';
import type { Message, Conversation } from '@/types';

export interface ExportData {
  version: string;
  exportedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  } | null;
  auth: {
    token: string | null;
    publicKey: string | null;
    privateKey: string | null;
  };
  conversations: Conversation[];
  messages: {
    [conversationId: string]: Message[];
  };
}

/**
 * Export all data from IndexedDB and localStorage
 */
export async function exportAllData(): Promise<ExportData> {
  try {
    // Get auth data from localStorage
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const publicKey = localStorage.getItem('publicKey');
    const privateKey = localStorage.getItem('privateKey');

    let user = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }

    // Get all conversations from IndexedDB
    const conversations = await localDB.getConversations();

    // Get all messages for each conversation
    const messages: { [conversationId: string]: Message[] } = {};
    for (const conversation of conversations) {
      const conversationMessages = await localDB.getMessages(conversation._id);
      messages[conversation._id] = conversationMessages;
    }

    const exportData: ExportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      user: user ? {
        id: user._id || user.id,
        username: user.username,
        email: user.email,
      } : null,
      auth: {
        token,
        publicKey,
        privateKey,
      },
      conversations,
      messages,
    };

    return exportData;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw new Error('Failed to export data');
  }
}

/**
 * Import data into IndexedDB and localStorage
 */
export async function importAllData(exportData: ExportData): Promise<void> {
  try {
    // Validate export data
    if (!exportData.version || !exportData.exportedAt) {
      throw new Error('Invalid export data format');
    }

    // Import auth data to localStorage
    if (exportData.auth.token) {
      localStorage.setItem('token', exportData.auth.token);
    }
    if (exportData.auth.publicKey) {
      localStorage.setItem('publicKey', exportData.auth.publicKey);
    }
    if (exportData.auth.privateKey) {
      localStorage.setItem('privateKey', exportData.auth.privateKey);
    }
    if (exportData.user) {
      localStorage.setItem('user', JSON.stringify(exportData.user));
    }

    // Import conversations to IndexedDB
    if (exportData.conversations && exportData.conversations.length > 0) {
      await localDB.saveConversations(exportData.conversations);
    }

    // Import messages to IndexedDB
    if (exportData.messages) {
      for (const conversationId in exportData.messages) {
        const conversationMessages = exportData.messages[conversationId];
        if (conversationMessages && conversationMessages.length > 0) {
          await localDB.saveMessages(conversationMessages);
        }
      }
    }

    // Data imported successfully
  } catch (error) {
    console.error('Error importing data:', error);
    throw new Error('Failed to import data');
  }
}

/**
 * Compress data to reduce QR code size
 */
export function compressData(data: string): string {
  // Simple compression: remove whitespace from JSON
  try {
    const parsed = JSON.parse(data);
    return JSON.stringify(parsed);
  } catch {
    return data;
  }
}

/**
 * Get export data size in bytes
 */
export function getDataSize(data: ExportData): number {
  const jsonString = JSON.stringify(data);
  return new Blob([jsonString]).size;
}

/**
 * Format data size for display
 */
export function formatDataSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Check if data is too large for QR code
 * QR codes can typically handle up to ~4KB efficiently
 */
export function isDataTooLarge(data: ExportData): boolean {
  const size = getDataSize(data);
  // Warn if over 2KB (conservative limit for QR codes)
  return size > 2048;
}

/**
 * Create a shareable export string
 */
export function createExportString(data: ExportData): string {
  return JSON.stringify(data);
}

/**
 * Parse import string
 */
export function parseImportString(dataString: string): ExportData {
  try {
    const data = JSON.parse(dataString);

    // Validate required fields
    if (!data.version || !data.exportedAt) {
      throw new Error('Invalid export data format');
    }

    return data as ExportData;
  } catch (error) {
    console.error('Error parsing import string:', error);
    throw new Error('Invalid export data format');
  }
}