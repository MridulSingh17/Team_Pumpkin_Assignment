import { useSocket } from "@/context/SocketContext";
import type { Message, MessagesPagination, SendMessageData } from "@/types";
import { deviceApi, handleApiError, messageApi } from "@/utils/api";
import {
  decryptMultiDeviceMessage,
  prepareMultiDeviceMessage,
  retrieveDeviceId,
  retrieveKeys,
} from "@/utils/encryption";
import {
  getImportedMessages,
  type ImportedMessage,
} from "@/utils/message-storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const {
    socket,
    connected,
    sendMessage: sendSocketMessage,
    onNewMessage,
  } = useSocket();

  // Track recently sent message contents (keyed by conversationId + approximate timestamp)
  // This helps us cache plaintext when messages come back from the server
  const recentSentMessages = useRef<Map<string, { content: string; timestamp: number }>>(new Map());

  // Decrypt a message using EC+ECDH
  const decryptMessageContent = useCallback(
    async (message: Message, currentUserId: string): Promise<string> => {
      try {
        // Check cache first
        const cacheKey = `decrypted_${message._id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          return cached;
        }

        const keys = await retrieveKeys();
        const deviceId = await retrieveDeviceId();

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
          // Check if we have the plaintext in recent sent messages
          const messageTime = new Date(message.timestamp).getTime();
          const now = Date.now();
          const timeDiff = Math.abs(now - messageTime);
          
          // Look for a recent sent message within 60 seconds of this message's timestamp
          let foundContent: string | null = null;
          for (const [key, value] of recentSentMessages.current.entries()) {
            if (key.startsWith(conversationId + "_")) {
              const sentTimeDiff = Math.abs(messageTime - value.timestamp);
              // If the sent message timestamp is within 60 seconds, it's likely this message
              if (sentTimeDiff < 60000) {
                foundContent = value.content;
                // Remove from map once found
                recentSentMessages.current.delete(key);
                break;
              }
            }
          }
          
          if (foundContent) {
            // Cache it immediately with the message ID
            await AsyncStorage.setItem(cacheKey, foundContent);
            return foundContent;
          }
          
          // Try to find in AsyncStorage backup
          const allKeys = await AsyncStorage.getAllKeys();
          const tempKeys = allKeys.filter(k => k.startsWith(`temp_sent_${conversationId}_`));
          for (const key of tempKeys) {
            try {
              const data = await AsyncStorage.getItem(key);
              if (data) {
                const { content, timestamp } = JSON.parse(data);
                const storedTimeDiff = Math.abs(messageTime - timestamp);
                if (storedTimeDiff < 60000) {
                  // Found in AsyncStorage backup
                  await AsyncStorage.removeItem(key);
                  await AsyncStorage.setItem(cacheKey, content);
                  return content;
                }
              }
            } catch (err) {
              console.error("Error reading temp storage:", err);
            }
          }
          
          // If not found in recent messages, check if it's a very recent message
          if (timeDiff < 60000) {
            console.warn(
              "Sent message not in cache - plaintext may have been lost:",
              message._id,
              "Time diff:",
              timeDiff,
              "ms",
            );
          } else {
            console.warn(
              "Sent message not in cache - plaintext may have been lost:",
              message._id,
            );
          }
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
            await AsyncStorage.setItem(cacheKey, decrypted);
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
        const deviceId = await retrieveDeviceId();

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

          // Load imported messages to merge with fetched messages
          const importedMessages = await getImportedMessages(conversationId);

          // Convert imported messages to Message format
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
              senderEncryptedVersions: [],
              recipientEncryptedVersions: [],
              timestamp: im.timestamp,
            }),
          );

          // Merge fetched messages with imported messages
          setMessages((prev) => {
            const allMessages =
              page === 1
                ? [...newMessages, ...importedAsMessages].sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() -
                      new Date(b.timestamp).getTime(),
                  )
                : [...prev, ...newMessages];

            console.log(
              `Fetched ${newMessages.length} messages from server, merged with ${importedAsMessages.length} imported messages. Total: ${allMessages.length}`,
            );

            return allMessages;
          });

          setPagination(response.data.pagination);

          // Save to AsyncStorage (only regular messages, not imported)
          await AsyncStorage.setItem(
            `messages_${conversationId}`,
            JSON.stringify(newMessages),
          );

          // Decrypt messages
          if (currentUserId) {
            // Decrypt regular messages
            Promise.all(
              newMessages.map(async (message) => {
                // Check if this is a recently sent message we have in the ref
                const senderId =
                  typeof message.senderId === "string"
                    ? message.senderId
                    : message.senderId._id;
                const isMySentMessage =
                  deviceId &&
                  senderId === currentUserId &&
                  message.senderDeviceId === deviceId;

                if (isMySentMessage) {
                  // Try to find the plaintext in recent sent messages
                  const messageTime = new Date(message.timestamp).getTime();
                  let foundContent: string | null = null;
                  
                  for (const [key, value] of recentSentMessages.current.entries()) {
                    if (key.startsWith(conversationId + "_")) {
                      const sentTimeDiff = Math.abs(messageTime - value.timestamp);
                      if (sentTimeDiff < 60000) {
                        foundContent = value.content;
                        recentSentMessages.current.delete(key);
                        break;
                      }
                    }
                  }
                  
                  if (foundContent) {
                    // Use the cached plaintext
                    const cacheKey = `decrypted_${message._id}`;
                    await AsyncStorage.setItem(cacheKey, foundContent);
                    setDecryptedMessages((prev) =>
                      new Map(prev).set(message._id, foundContent),
                    );
                  } else {
                    // Fall back to normal decryption
                    const decrypted = await decryptMessageContent(
                      message,
                      currentUserId,
                    );
                    setDecryptedMessages((prev) =>
                      new Map(prev).set(message._id, decrypted),
                    );
                  }
                } else {
                  // Decrypt normally
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

            // Add imported messages to decrypted map (already decrypted)
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
    [conversationId, decryptMessageContent, currentUserId],
  );

  // Send a new message
  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!conversationId) {
        setError("No conversation selected");
        return false;
      }

      const keys = await retrieveKeys();
      const deviceId = await retrieveDeviceId();

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
          senderOtherDevices,
          recipientDevices,
        );

        // Store plaintext locally - when message comes back, use this
        // Use conversationId + current timestamp as key (messages within 60 seconds are considered recent)
        const sentTimestamp = Date.now();
        const sentMessageKey = `${conversationId}_${sentTimestamp}`;
        recentSentMessages.current.set(sentMessageKey, {
          content,
          timestamp: sentTimestamp,
        });
        
        // Also store in AsyncStorage as backup
        const tempStorageKey = `temp_sent_${conversationId}_${sentTimestamp}`;
        await AsyncStorage.setItem(tempStorageKey, JSON.stringify({
          content,
          timestamp: sentTimestamp,
        }));
        
        // Clean up old entries (older than 120 seconds)
        const now = Date.now();
        for (const [key, value] of recentSentMessages.current.entries()) {
          if (now - value.timestamp > 120000) {
            recentSentMessages.current.delete(key);
          }
        }
        
        // Clean up old AsyncStorage entries
        const allKeys = await AsyncStorage.getAllKeys();
        const oldTempKeys = allKeys.filter(k => k.startsWith(`temp_sent_${conversationId}_`));
        for (const key of oldTempKeys) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const { timestamp } = JSON.parse(data);
              if (now - timestamp > 120000) {
                await AsyncStorage.removeItem(key);
              }
            }
          } catch (err) {
            // Remove corrupted entries
            await AsyncStorage.removeItem(key);
          }
        }

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
      } finally {
        setLoading(false);
      }
    },
    [conversationId, recipientId, connected, socket, sendSocketMessage],
  );

  // Handle new incoming messages from socket
  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleNewMessage = async (message: Message) => {
      // Only add message if it belongs to current conversation
      if (message.conversationId === conversationId) {
        setMessages((prev) => {
          // Check if message already exists
          if (prev.some((m) => m._id === message._id)) {
            return prev;
          }
          return [...prev, message];
        });

        // Save message to AsyncStorage
        const storageKey = `messages_${conversationId}`;
        const stored = await AsyncStorage.getItem(storageKey);
        const storedMessages = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify([...storedMessages, message]),
        );

        // Decrypt the new message
        if (currentUserId) {
          // Check if this is a message we just sent
          const senderId =
            typeof message.senderId === "string"
              ? message.senderId
              : message.senderId._id;
          const deviceId = await retrieveDeviceId();
          const isMySentMessage =
            deviceId &&
            senderId === currentUserId &&
            message.senderDeviceId === deviceId;

          // If it's our sent message, try to find it in recent sent messages
          if (isMySentMessage) {
            const messageTime = new Date(message.timestamp).getTime();
            let foundContent: string | null = null;
            
            // Look for a recent sent message within 60 seconds
            for (const [key, value] of recentSentMessages.current.entries()) {
              if (key.startsWith(conversationId + "_")) {
                const sentTimeDiff = Math.abs(messageTime - value.timestamp);
                if (sentTimeDiff < 60000) {
                  foundContent = value.content;
                  recentSentMessages.current.delete(key);
                  break;
                }
              }
            }
            
            if (foundContent) {
              const cacheKey = `decrypted_${message._id}`;
              await AsyncStorage.setItem(cacheKey, foundContent);
              setDecryptedMessages((prev) =>
                new Map(prev).set(message._id, foundContent),
              );
            } else {
              // Fall back to normal decryption
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
          } else {
            // Otherwise, decrypt normally
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

    onNewMessage(handleNewMessage);

    // Cleanup listener on unmount
    return () => {
      if (socket) {
        socket.off("new_message", handleNewMessage);
      }
    };
  }, [
    socket,
    conversationId,
    onNewMessage,
    decryptMessageContent,
    currentUserId,
  ]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) return;

    const loadMessages = async () => {
      try {
        setMessages([]);
        setDecryptedMessages(new Map());

        // Load from AsyncStorage first
        const storageKey = `messages_${conversationId}`;
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const localMessages = JSON.parse(stored);
          setMessages(localMessages);

          // Decrypt local messages
          if (currentUserId) {
            const decryptedMap = new Map<string, string>();
            await Promise.all(
              localMessages.map(async (message: Message) => {
                const decrypted = await decryptMessageContent(
                  message,
                  currentUserId,
                );
                decryptedMap.set(message._id, decrypted);
              }),
            );
            setDecryptedMessages(decryptedMap);
          }
        }

        // Load imported messages for this conversation
        const importedMessages = await getImportedMessages(conversationId);
        console.log(
          `Loaded ${importedMessages.length} imported messages for conversation ${conversationId}`,
        );
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
              senderEncryptedVersions: [],
              recipientEncryptedVersions: [],
              timestamp: im.timestamp,
            }),
          );

          // Merge with regular messages and sort by timestamp
          const stored = await AsyncStorage.getItem(storageKey);
          const localMessages = stored ? JSON.parse(stored) : [];
          const allMessages = [...localMessages, ...importedAsMessages].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );

          setMessages(allMessages);
          console.log(
            `Set ${allMessages.length} total messages (${localMessages.length} regular + ${importedAsMessages.length} imported)`,
          );

          // Cache decrypted content for imported messages
          if (currentUserId) {
            const decryptedMap = new Map<string, string>();

            // Decrypt regular messages
            await Promise.all(
              localMessages.map(async (message: Message) => {
                const decrypted = await decryptMessageContent(
                  message,
                  currentUserId,
                );
                decryptedMap.set(message._id, decrypted);
              }),
            );

            // Add imported messages (already decrypted)
            importedMessages.forEach((im) => {
              decryptedMap.set(im._id, im.content);
            });

            setDecryptedMessages(decryptedMap);
          }
        }

        // Then fetch from server
        fetchMessages(1);
      } catch (err) {
        console.error("Error loading messages:", err);
        fetchMessages(1);
      }
    };

    loadMessages();
  }, [conversationId, currentUserId, decryptMessageContent, fetchMessages]);

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
