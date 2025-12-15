"use client";

import { useEffect, useCallback } from 'react';
import { localDB } from '@/lib/localDB';

/**
 * Hook for managing local storage operations and cleanup
 */
export function useLocalStorage() {
  // Initialize IndexedDB on mount
  useEffect(() => {
    localDB.init().catch(err => {
      console.error('Failed to initialize local database:', err);
    });
  }, []);

  // Periodic cleanup of old decrypted messages (runs every hour)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      localDB.clearOldDecryptedMessages().catch(err => {
        console.error('Failed to cleanup old decrypted messages:', err);
      });
    }, 60 * 60 * 1000); // 1 hour

    // Run cleanup on mount
    localDB.clearOldDecryptedMessages().catch(err => {
      console.error('Failed to cleanup old decrypted messages:', err);
    });

    return () => clearInterval(cleanupInterval);
  }, []);

  // Clear all local data
  const clearAllData = useCallback(async () => {
    try {
      await localDB.clearAll();
      // All local data cleared
    } catch (error) {
      console.error('Error clearing local data:', error);
      throw error;
    }
  }, []);

  // Export conversation data
  const exportConversationData = useCallback(async (conversationId: string) => {
    try {
      const messages = await localDB.getMessages(conversationId);
      const conversation = await localDB.getConversation(conversationId);

      return {
        conversation,
        messages,
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error exporting conversation data:', error);
      throw error;
    }
  }, []);

  // Get storage statistics
  const getStorageStats = useCallback(async () => {
    try {
      const conversations = await localDB.getConversations();
      let totalMessages = 0;

      for (const conv of conversations) {
        const messages = await localDB.getMessages(conv._id);
        totalMessages += messages.length;
      }

      return {
        conversationCount: conversations.length,
        messageCount: totalMessages,
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        conversationCount: 0,
        messageCount: 0,
      };
    }
  }, []);

  return {
    clearAllData,
    exportConversationData,
    getStorageStats,
  };
}