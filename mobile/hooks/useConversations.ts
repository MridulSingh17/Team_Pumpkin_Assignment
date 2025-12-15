import useLocalStorageState from "@/components/utils/useLocalStorageState";
import type { Conversation, CreateConversationData } from "@/types";
import { conversationApi, handleApiError } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";

export function useConversations() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { setItemToLocalStorage } = useLocalStorageState();

    // Fetch all conversations
    const fetchConversations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await conversationApi.getAll();
            if (response.success && response.data) {
                const fetchedConversations = response.data.conversations;
                setConversations(fetchedConversations);
                console.info(`Fetched ${fetchedConversations} conversations`);

                // Save to AsyncStorage
                await setItemToLocalStorage(
                    "conversations",
                    JSON.stringify(fetchedConversations)
                );
            }
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error("Error fetching conversations:", errorMessage);
        } finally {
            setLoading(false);
        }
    }, [setItemToLocalStorage]);

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
                            const exists = prev.find(
                                (c) => c._id === conversation._id
                            );
                            if (!exists) {
                                return [conversation, ...prev];
                            }
                            return prev;
                        });
                    }

                    // Save to AsyncStorage
                    const updatedConversations = isNew
                        ? [conversation, ...conversations]
                        : conversations.map((c) =>
                              c._id === conversation._id ? conversation : c
                          );
                    await setItemToLocalStorage(
                        "conversations",
                        JSON.stringify(updatedConversations)
                    );

                    return conversation;
                }
                return null;
            } catch (err) {
                const errorMessage = handleApiError(err);
                setError(errorMessage);
                console.error(
                    "Error getting or creating conversation:",
                    errorMessage
                );
                throw err;
            }
        },
        [conversations, setItemToLocalStorage]
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

                    // Save to AsyncStorage
                    await setItemToLocalStorage(
                        "conversations",
                        JSON.stringify([newConversation, ...conversations])
                    );

                    return newConversation;
                }
                return null;
            } catch (err) {
                const errorMessage = handleApiError(err);
                setError(errorMessage);
                console.error("Error creating conversation:", errorMessage);
                throw err;
            }
        },
        [conversations, setItemToLocalStorage]
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
                console.error("Error fetching conversation:", errorMessage);
                return null;
            }
        },
        []
    );

    // Update conversation in local state
    const updateConversation = useCallback(
        async (updatedConversation: Conversation) => {
            setConversations((prev) =>
                prev.map((conv) =>
                    conv._id === updatedConversation._id
                        ? updatedConversation
                        : conv
                )
            );

            // Update in AsyncStorage
            const updated = conversations.map((c) =>
                c._id === updatedConversation._id ? updatedConversation : c
            );
            await setItemToLocalStorage(
                "conversations",
                JSON.stringify(updated)
            );
        },
        [conversations, setItemToLocalStorage]
    );

    // Update last message for a conversation
    const updateLastMessage = useCallback(
        async (conversationId: string, lastMessageAt: string) => {
            setConversations((prev) => {
                const updated = prev
                    .map((conv) => {
                        if (conv._id === conversationId) {
                            return { ...conv, lastMessageAt };
                        }
                        return conv;
                    })
                    .sort(
                        (a, b) =>
                            new Date(b.lastMessageAt).getTime() -
                            new Date(a.lastMessageAt).getTime()
                    );

                // Update in AsyncStorage
                setItemToLocalStorage("conversations", JSON.stringify(updated));

                return updated;
            });
        },
        [setItemToLocalStorage]
    );

    // Load conversations on mount
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

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
