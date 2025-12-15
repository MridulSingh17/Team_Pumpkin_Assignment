'use client';

import { useState, useEffect, useCallback } from 'react';
import { conversationApi, handleApiError } from '@/lib/api';
import { localDB } from '@/lib/localDB';
import type { Conversation, CreateConversationData } from '@/types';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localLoaded, setLocalLoaded] = useState(false);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await conversationApi.getAll();
      if (response.success && response.data) {
        const fetchedConversations = response.data.conversations;
        setConversations(fetchedConversations);

        // Save to local storage
        await localDB.saveConversations(fetchedConversations);
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error('Error fetching conversations:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get or create a conversation
  const getOrCreateConversation = useCallback(
    async (data: CreateConversationData): Promise<Conversation | null> => {
      try {
        setError(null);
        const response = await conversationApi.getOrCreate(data);
        if (response.success && response.data) {
          const conversation = response.data.conversation;
          const isNew = response.data.isNew;

          // Update conversations list
          if (isNew) {
            setConversations((prev) => [conversation, ...prev]);
          } else {
            // Update existing conversation in the list
            setConversations((prev) => {
              const exists = prev.find(c => c._id === conversation._id);
              if (!exists) {
                return [conversation, ...prev];
              }
              return prev;
            });
          }

          // Save to local storage
          await localDB.saveConversation(conversation);

          return conversation;
        }
        return null;
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error('Error getting or creating conversation:', errorMessage);
        throw err;
      }
    },
    []
  );

  // Create a new conversation
  const createConversation = useCallback(
    async (data: CreateConversationData): Promise<Conversation | null> => {
      try {
        setError(null);
        const response = await conversationApi.create(data);
        if (response.success && response.data) {
          const newConversation = response.data.conversation;
          setConversations((prev) => [newConversation, ...prev]);

          // Save to local storage
          await localDB.saveConversation(newConversation);

          return newConversation;
        }
        return null;
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error('Error creating conversation:', errorMessage);
        throw err;
      }
    },
    []
  );

  // Get conversation by ID
  const getConversationById = useCallback(
    async (conversationId: string): Promise<Conversation | null> => {
      try {
        setError(null);
        const response = await conversationApi.getById(conversationId);
        if (response.success && response.data) {
          return response.data.conversation;
        }
        return null;
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error('Error fetching conversation:', errorMessage);
        return null;
      }
    },
    []
  );

  // Update conversation in local state (e.g., when new message arrives)
  const updateConversation = useCallback(async (updatedConversation: Conversation) => {
    setConversations((prev) =>
      prev.map((conv) => (conv._id === updatedConversation._id ? updatedConversation : conv))
    );

    // Update in local storage
    await localDB.saveConversation(updatedConversation);
  }, []);

  // Update last message for a conversation
  const updateLastMessage = useCallback(async (conversationId: string, lastMessageAt: string) => {
    setConversations((prev) => {
      const updated = prev
        .map((conv) => {
          if (conv._id === conversationId) {
            return { ...conv, lastMessageAt };
          }
          return conv;
        })
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      // Update in local storage
      const updatedConv = updated.find(c => c._id === conversationId);
      if (updatedConv) {
        localDB.saveConversation(updatedConv);
      }

      return updated;
    });
  }, []);

  // Load conversations from local storage first, then fetch from server
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLocalLoaded(false);

        // Load from local storage first for instant display
        const localConversations = await localDB.getConversations();
        if (localConversations.length > 0) {
          setConversations(localConversations);
        }

        setLocalLoaded(true);

        // Then fetch from server to get latest data
        await fetchConversations();
      } catch (err) {
        console.error('Error loading local conversations:', err);
        setLocalLoaded(true);
        await fetchConversations();
      }
    };

    loadConversations();
  }, []);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    createConversation,
    getOrCreateConversation,
    getConversationById,
    updateConversation,
    updateLastMessage,
  };
}