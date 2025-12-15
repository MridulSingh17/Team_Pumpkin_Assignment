"use client";

import { useState, useEffect, useCallback } from "react";
import { messageApi, handleApiError, deviceApi } from "@/lib/api";
import {
  retrieveKeys,
  retrieveDeviceId,
  prepareMultiDeviceMessage,
  decryptMessageFromDevices
} from "@/lib/encryption";
import { useSocket } from "@/context/SocketContext";
import { localDB, type ImportedMessage } from "@/lib/localDB";
import type { Message, SendMessageData, MessagesPagination } from "@/types";

interface UseMessagesOptions {
  conversationId: string | null;
  recipientId: string;
  currentUserId?: string;
}

export function useMessages({ conversationId, recipientId, currentUserId }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<
    Map<string, string>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<MessagesPagination | null>(null);
  const {
    socket,
    connected,
    sendMessage: sendSocketMessage,
  } = useSocket();

  // Decrypt a message
  const decryptMessageContent = useCallback(
    async (message: Message, currentUserId: string): Promise<string> => {
      try {
        // Check cache first
        const cached = await localDB.getDecryptedMessage(message._id);
        if (cached) {
          return cached;
        }

        const keys = retrieveKeys();
        const deviceId = retrieveDeviceId();

        if (!keys || !deviceId) {
          console.error("CRITICAL: No encryption keys or device ID found!");
          throw new Error("Encryption keys or device ID not found");
        }

        // Handle multi-device encryption format
        if (message.senderEncryptedVersions && message.recipientEncryptedVersions) {
          // Determine which encrypted content to use based on whether user is sender or recipient
          const senderId = typeof message.senderId === 'string'
            ? message.senderId
            : message.senderId._id;
          const isSender = senderId === currentUserId;

          const encryptedVersions = isSender
            ? message.senderEncryptedVersions
            : message.recipientEncryptedVersions;

          // Decrypt using device-specific encryption
          const decrypted = await decryptMessageFromDevices(
            encryptedVersions,
            deviceId,
            keys.privateKey
          );

          // Only cache if successfully decrypted
          if (decrypted && !decrypted.startsWith('[')) {
            await localDB.saveDecryptedMessage(message._id, decrypted);
          }

          return decrypted;
        }

        // If we get here, something is wrong with the message format
        console.error('Message has no encrypted versions:', message);
        return "[Message format not supported]";
      } catch (err) {
        console.error("Error in decryptMessageContent:", err);
        return "[Unable to decrypt - error occurred]";
      }
    },
    [],
  );

  // Fetch messages for a conversation
  const fetchMessages = useCallback(
    async (page: number = 1, limit: number = 50) => {
      if (!conversationId) return;

      try {
        setLoading(true);
        setError(null);

        // Get user's current device ID
        const deviceId = retrieveDeviceId();

        if (!deviceId) {
          throw new Error("Device ID not found. Please log in again.");
        }

        const response = await messageApi.getMessages(
          conversationId,
          page,
          limit,
          deviceId, // Pass deviceId to filter messages
        );

        if (response.success && response.data) {
          const newMessages = response.data.messages;
          setMessages((prev) =>
            page === 1 ? newMessages : [...prev, ...newMessages],
          );
          setPagination(response.data.pagination);

          // Save messages to local storage
          await localDB.saveMessages(newMessages);

          // Decrypt messages
          if (currentUserId) {
            Promise.all(
              newMessages.map(async (message) => {
                const decrypted = await decryptMessageContent(message, currentUserId);
                setDecryptedMessages((prev) => new Map(prev).set(message._id, decrypted));
              }),
            );
          }

          // Also load imported messages for this conversation
          const importedMessages = await localDB.getImportedMessages(conversationId);
          if (importedMessages.length > 0) {
            // Convert imported messages to Message format for display
            const importedAsMessages: Message[] = importedMessages.map((im: ImportedMessage) => ({
              _id: im._id,
              conversationId: im.conversationId,
              senderId: {
                _id: im.senderId,
                username: im.senderUsername,
                email: '',
              },
              recipientId: '',
              senderDeviceId: '',
              senderEncryptedVersions: [],
              recipientEncryptedVersions: [],
              timestamp: im.timestamp,
            }));

            // Merge with regular messages and sort by timestamp
            const allMessages = [...newMessages, ...importedAsMessages].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            setMessages(page === 1 ? allMessages : [...messages, ...allMessages]);

            // Cache decrypted content for imported messages
            importedMessages.forEach((im) => {
              setDecryptedMessages((prev) => new Map(prev).set(im._id, im.content));
            });
          }
        }
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error("Error fetching messages:", errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, decryptMessageContent, currentUserId, messages],
  );

  // Send a new message
  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!conversationId) {
        setError("No conversation selected");
        return false;
      }

      const keys = retrieveKeys();
      const deviceId = retrieveDeviceId();

      if (!keys || !deviceId) {
        setError("Encryption keys or device ID not found. Please log in again.");
        return false;
      }

      try {
        // Don't set loading to true when sending - prevents full screen reload effect
        setError(null);

        // Get sender's devices (current user)
        const senderDevicesResponse = await deviceApi.getMyDevices();
        if (!senderDevicesResponse.success || !senderDevicesResponse.data?.devices) {
          throw new Error("Failed to fetch sender devices");
        }
        const senderDevices = senderDevicesResponse.data.devices;

        // Get recipient's devices
        const recipientDevicesResponse = await deviceApi.getUserDevices(recipientId);
        if (!recipientDevicesResponse.success || !recipientDevicesResponse.data?.devices) {
          throw new Error("Failed to fetch recipient devices");
        }
        const recipientDevices = recipientDevicesResponse.data.devices;

        // Validate we have devices
        if (senderDevices.length === 0) {
          throw new Error("No active devices found for sender");
        }
        if (recipientDevices.length === 0) {
          throw new Error("No active devices found for recipient");
        }

        // Prepare multi-device encrypted message
        const encryptedData = await prepareMultiDeviceMessage(
          content,
          senderDevices,
          recipientDevices,
          deviceId
        );

        // Send via socket if connected, otherwise use HTTP
        if (connected && socket) {
          await sendSocketMessage({
            conversationId,
            ...encryptedData,
          });
        } else {
          const messageData: SendMessageData = {
            conversationId,
            ...encryptedData,
          };
          await messageApi.send(messageData);
        }

        return true;
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error("Error sending message:", errorMessage, err);
        return false;
      }
    },
    [conversationId, recipientId, connected, socket, sendSocketMessage],
  );

  // Handle new incoming messages from socket
  useEffect(() => {
    if (!socket || !conversationId) {
      return;
    }

    const handleNewMessage = async (data: Message | { message: Message }) => {
      const message = 'message' in data ? data.message : data;

      // Only add message if it belongs to current conversation
      if (message.conversationId === conversationId) {
        setMessages((prev) => {
          // Check if message already exists
          if (prev.some((m) => m._id === message._id)) {
            return prev;
          }
          return [...prev, message];
        });

        // Save message to local storage
        await localDB.saveMessage(message);

        // Decrypt the new message
        if (currentUserId) {
          decryptMessageContent(message, currentUserId).then((decrypted) => {
            setDecryptedMessages((prev) => new Map(prev).set(message._id, decrypted));
          }).catch(err => {
            console.error('Failed to decrypt new message:', err);
          });
        }
      }
    };

    // Directly listen on socket instead of using onNewMessage callback
    socket.on("new_message", handleNewMessage);

    // Cleanup listener on unmount
    return () => {
      if (socket) {
        socket.off("new_message", handleNewMessage);
      }
    };
  }, [socket, conversationId, decryptMessageContent, currentUserId]);

  // Fetch messages from server (skip local storage to avoid decryption errors from old keys)
  useEffect(() => {
    if (!conversationId) return;

    const loadMessages = async () => {
      try {
        setMessages([]);
        setDecryptedMessages(new Map());
        setLoading(true);
        setError(null);

        // Get user's current device ID
        const deviceId = retrieveDeviceId();

        if (!deviceId) {
          throw new Error("Device ID not found. Please log in again.");
        }

        const response = await messageApi.getMessages(
          conversationId,
          1,
          50,
          deviceId,
        );

        if (response.success && response.data) {
          const newMessages = response.data.messages;
          setMessages(newMessages);
          setPagination(response.data.pagination);

          // Save messages to local storage
          await localDB.saveMessages(newMessages);

          // Decrypt messages
          if (currentUserId) {
            Promise.all(
              newMessages.map(async (message) => {
                const decrypted = await decryptMessageContent(message, currentUserId);
                setDecryptedMessages((prev) => new Map(prev).set(message._id, decrypted));
              }),
            );
          }

          // Also load imported messages for this conversation
          const importedMessages = await localDB.getImportedMessages(conversationId);
          if (importedMessages.length > 0) {
            // Convert imported messages to Message format for display
            const importedAsMessages: Message[] = importedMessages.map((im: ImportedMessage) => ({
              _id: im._id,
              conversationId: im.conversationId,
              senderId: {
                _id: im.senderId,
                username: im.senderUsername,
                email: '',
              },
              recipientId: '',
              senderDeviceId: '',
              senderEncryptedVersions: [],
              recipientEncryptedVersions: [],
              timestamp: im.timestamp,
            }));

            // Merge with regular messages and sort by timestamp
            const allMessages = [...newMessages, ...importedAsMessages].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            setMessages(allMessages);

            // Cache decrypted content for imported messages
            importedMessages.forEach((im) => {
              setDecryptedMessages((prev) => new Map(prev).set(im._id, im.content));
            });
          }
        }
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error("Error fetching messages:", errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [conversationId, currentUserId, decryptMessageContent]);

  // Get decrypted content for a message
  const getDecryptedContent = useCallback(
    (messageId: string): string => {
      return decryptedMessages.get(messageId) || "";
    },
    [decryptedMessages],
  );

  // Load more messages (pagination)
  const loadMore = useCallback(() => {
    if (pagination && pagination.hasNextPage) {
      fetchMessages(pagination.currentPage + 1);
    }
  }, [pagination, fetchMessages]);

  return {
    messages,
    loading,
    error,
    pagination,
    sendMessage,
    fetchMessages,
    getDecryptedContent,
    loadMore,
    hasMore: pagination?.hasNextPage || false,
  };
}
