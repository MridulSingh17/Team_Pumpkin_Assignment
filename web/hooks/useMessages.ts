"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { messageApi, handleApiError, deviceApi } from "@/lib/api";
import {
  retrieveKeys,
  retrieveDeviceId,
  prepareMultiDeviceMessage,
  decryptMultiDeviceMessage,
} from "@/lib/encryption";
import { useSocket } from "@/context/SocketContext";
import { localDB, type ImportedMessage } from "@/lib/localDB";
import type { Message, SendMessageData, MessagesPagination } from "@/types";

interface UseMessagesOptions {
  conversationId: string | null;
  recipientId: string;
  currentUserId?: string;
}

export function useMessages({
  conversationId,
  recipientId,
  currentUserId,
}: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<
    Map<string, string>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<MessagesPagination | null>(null);
  const { socket, connected, sendMessage: sendSocketMessage } = useSocket();

  // Track the last sent message content (we just sent it, no need to decrypt)
  const lastSentMessageContent = useRef<string | null>(null);

  // Decrypt a message using EC+ECDH
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

        // Check if this is our own sent message from this device
        const senderId =
          typeof message.senderId === "string"
            ? message.senderId
            : message.senderId._id;
        const isMySentMessage =
          senderId === currentUserId && message.senderDeviceId === deviceId;

        if (isMySentMessage) {
          // This is a message we sent from this device
          // We don't encrypt for ourselves, so there's no encrypted version for this device
          // The plaintext should have been cached when we sent it
          // If it's not cached, something went wrong
          console.warn(
            "Sent message not in cache - plaintext may have been lost:",
            message._id,
          );
          return "[Sent message - plaintext not cached]";
        }

        // Handle new unified encryptedVersions format (EC+ECDH)
        if (message.encryptedVersions && message.encryptedVersions.length > 0) {
          // Get sender device's public key for ECDH
          const senderDeviceResponse = await deviceApi.getDevice(
            message.senderDeviceId,
          );
          if (
            !senderDeviceResponse.success ||
            !senderDeviceResponse.data?.device
          ) {
            throw new Error("Failed to fetch sender device info");
          }
          const senderDevicePublicKey =
            senderDeviceResponse.data.device.publicKey;

          // Decrypt using ECDH-derived key
          const decrypted = await decryptMultiDeviceMessage(
            message.encryptedVersions,
            deviceId,
            senderDevicePublicKey,
          );

          // Only cache if successfully decrypted
          if (decrypted && !decrypted.startsWith("[")) {
            await localDB.saveDecryptedMessage(message._id, decrypted);
          }

          return decrypted;
        }

        // If we get here, something is wrong with the message format
        console.error("Message has no encrypted versions:", message);
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

        // Fetch messages from backend (filtered for this device)
        // Returns: messages encrypted for this device OR sent from this device
        const response = await messageApi.getMessages(
          conversationId,
          page,
          limit,
          deviceId,
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
                // Check if we already have decrypted content cached
                const cached = await localDB.getDecryptedMessage(message._id);
                if (cached) {
                  setDecryptedMessages((prev) =>
                    new Map(prev).set(message._id, cached),
                  );
                } else {
                  // Decrypt and cache
                  const decrypted = await decryptMessageContent(
                    message,
                    currentUserId,
                  );
                  setDecryptedMessages((prev) =>
                    new Map(prev).set(message._id, decrypted),
                  );
                }
              }),
            );
          }

          // Also load imported messages for this conversation
          const importedMessages =
            await localDB.getImportedMessages(conversationId);
          if (importedMessages.length > 0) {
            // Convert imported messages to Message format for display
            const importedAsMessages: Message[] = importedMessages.map(
              (im: ImportedMessage) => ({
                _id: im._id,
                conversationId: im.conversationId,
                senderId: {
                  _id: im.senderId,
                  username: im.senderUsername,
                  email: "",
                },
                recipientId: "",
                senderDeviceId: "",
                encryptedVersions: [],
                timestamp: im.timestamp,
              }),
            );

            // Merge with regular messages and sort by timestamp
            const allMessages = [...newMessages, ...importedAsMessages].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime(),
            );

            setMessages(
              page === 1 ? allMessages : [...messages, ...allMessages],
            );

            // Cache decrypted content for imported messages
            importedMessages.forEach((im) => {
              setDecryptedMessages((prev) =>
                new Map(prev).set(im._id, im.content),
              );
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
        setError(
          "Encryption keys or device ID not found. Please log in again.",
        );
        return false;
      }

      try {
        // Don't set loading to true when sending - prevents full screen reload effect
        setError(null);

        // Get sender's OTHER devices (excluding current) for multi-device sync
        const senderDevicesResponse = await deviceApi.getMyDevices();
        if (
          !senderDevicesResponse.success ||
          !senderDevicesResponse.data?.devices
        ) {
          throw new Error("Failed to fetch sender devices");
        }
        const allSenderDevices = senderDevicesResponse.data.devices;
        const senderOtherDevices = allSenderDevices.filter(
          (d) => d._id !== deviceId,
        );

        // Get recipient's devices
        const recipientDevicesResponse =
          await deviceApi.getUserDevices(recipientId);
        if (
          !recipientDevicesResponse.success ||
          !recipientDevicesResponse.data?.devices
        ) {
          throw new Error("Failed to fetch recipient devices");
        }
        const recipientDevices = recipientDevicesResponse.data.devices;

        // Validate we have recipient devices
        if (recipientDevices.length === 0) {
          throw new Error("No active devices found for recipient");
        }

        // Prepare encrypted message for:
        // - Sender's OTHER devices (not current - we have plaintext!)
        // - Recipient's ALL devices
        const encryptedData = await prepareMultiDeviceMessage(
          content,
          deviceId,
          senderOtherDevices, // Only OTHER devices - current device stores plaintext locally
          recipientDevices,
        );

        // Store plaintext locally - when message comes back, use this
        lastSentMessageContent.current = content;

        // Note: The message will be saved to IndexedDB when it comes back from the socket
        // with the actual message ID from the backend

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
      const message = "message" in data ? data.message : data;

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

        // Check if this is a message we just sent (from this device)
        const senderId =
          typeof message.senderId === "string"
            ? message.senderId
            : message.senderId._id;
        const isMySentMessage =
          senderId === currentUserId &&
          message.senderDeviceId === retrieveDeviceId();

        if (isMySentMessage && lastSentMessageContent.current) {
          // This is our own just-sent message - use the plaintext we have
          const plaintext = lastSentMessageContent.current;
          setDecryptedMessages((prev) =>
            new Map(prev).set(message._id, plaintext),
          );
          // Cache it permanently in IndexedDB
          await localDB.saveDecryptedMessage(message._id, plaintext);
          // Clear the ref
          lastSentMessageContent.current = null;
        } else if (isMySentMessage) {
          // This is our old sent message (from page refresh/reload)
          // Check if we have it cached
          const cached = await localDB.getDecryptedMessage(message._id);
          if (cached) {
            setDecryptedMessages((prev) =>
              new Map(prev).set(message._id, cached),
            );
          } else {
            // Shouldn't happen, but decrypt as fallback
            if (currentUserId) {
              decryptMessageContent(message, currentUserId)
                .then((decrypted) => {
                  setDecryptedMessages((prev) =>
                    new Map(prev).set(message._id, decrypted),
                  );
                })
                .catch((err) => {
                  console.error("Failed to decrypt sent message:", err);
                });
            }
          }
        } else {
          // Decrypt messages from others (or our old messages when fetching)
          if (currentUserId) {
            decryptMessageContent(message, currentUserId)
              .then((decrypted) => {
                setDecryptedMessages((prev) =>
                  new Map(prev).set(message._id, decrypted),
                );
              })
              .catch((err) => {
                console.error("Failed to decrypt new message:", err);
              });
          }
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
                const decrypted = await decryptMessageContent(
                  message,
                  currentUserId,
                );
                setDecryptedMessages((prev) =>
                  new Map(prev).set(message._id, decrypted),
                );
              }),
            );
          }

          // Also load imported messages for this conversation
          const importedMessages =
            await localDB.getImportedMessages(conversationId);
          if (importedMessages.length > 0) {
            // Convert imported messages to Message format for display
            const importedAsMessages: Message[] = importedMessages.map(
              (im: ImportedMessage) => ({
                _id: im._id,
                conversationId: im.conversationId,
                senderId: {
                  _id: im.senderId,
                  username: im.senderUsername,
                  email: "",
                },
                recipientId: "",
                senderDeviceId: "",
                encryptedVersions: [],
                timestamp: im.timestamp,
              }),
            );

            // Merge with regular messages and sort by timestamp
            const allMessages = [...newMessages, ...importedAsMessages].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime(),
            );

            setMessages(allMessages);

            // Cache decrypted content for imported messages
            importedMessages.forEach((im) => {
              setDecryptedMessages((prev) =>
                new Map(prev).set(im._id, im.content),
              );
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
