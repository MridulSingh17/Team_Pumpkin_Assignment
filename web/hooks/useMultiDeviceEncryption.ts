/**
 * Custom hook for multi-device encryption support
 * Handles encryption and decryption of messages across multiple devices
 */

import { useState, useCallback } from 'react';
import {
  prepareMultiDeviceMessage,
  decryptMessageFromDevices,
  retrieveKeys,
  retrieveDeviceId,
  Device,
  DeviceEncryptedVersion,
} from '@/lib/encryption';
import { deviceApi } from '@/lib/api';
import type { Message } from '@/types';

interface UseMultiDeviceEncryptionReturn {
  encryptForMultiDevice: (
    message: string,
    recipientId: string
  ) => Promise<{
    senderDeviceId: string;
    senderEncryptedVersions: DeviceEncryptedVersion[];
    recipientEncryptedVersions: DeviceEncryptedVersion[];
  }>;
  decryptMultiDeviceMessage: (message: Message) => Promise<string>;
  loading: boolean;
  error: string | null;
}

export function useMultiDeviceEncryption(): UseMultiDeviceEncryptionReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Encrypt a message for all devices of both sender and recipient
   */
  const encryptForMultiDevice = useCallback(
    async (
      message: string,
      recipientId: string
    ): Promise<{
      senderDeviceId: string;
      senderEncryptedVersions: DeviceEncryptedVersion[];
      recipientEncryptedVersions: DeviceEncryptedVersion[];
    }> => {
      try {
        setLoading(true);
        setError(null);

        // Get current device ID
        const currentDeviceId = retrieveDeviceId();
        if (!currentDeviceId) {
          throw new Error('Device not registered. Please log in again.');
        }

        // Get sender's devices (current user)
        const senderDevicesResponse = await deviceApi.getMyDevices();
        if (!senderDevicesResponse.success || !senderDevicesResponse.data?.devices) {
          throw new Error('Failed to fetch sender devices');
        }
        const senderDevices = senderDevicesResponse.data.devices;

        // Get recipient's devices
        const recipientDevicesResponse = await deviceApi.getUserDevices(recipientId);
        if (!recipientDevicesResponse.success || !recipientDevicesResponse.data?.devices) {
          throw new Error('Failed to fetch recipient devices');
        }
        const recipientDevices = recipientDevicesResponse.data.devices;

        // Validate we have devices
        if (senderDevices.length === 0) {
          throw new Error('No active devices found for sender');
        }
        if (recipientDevices.length === 0) {
          throw new Error('No active devices found for recipient');
        }

        // Find current device in sender's devices
        const currentDevice = senderDevices.find((d) => d._id === currentDeviceId);
        if (!currentDevice) {
          throw new Error('Current device not found in active devices');
        }

        // Prepare multi-device encrypted message
        const result = await prepareMultiDeviceMessage(
          message,
          senderDevices,
          recipientDevices,
          currentDeviceId
        );

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to encrypt message';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Decrypt a message that was encrypted for multiple devices
   */
  const decryptMultiDeviceMessage = useCallback(async (message: Message): Promise<string> => {
    try {
      setError(null);

      // Get current user's keys and device ID
      const keys = retrieveKeys();
      const deviceId = retrieveDeviceId();

      if (!keys || !deviceId) {
        return '[Unable to decrypt - keys or device ID not found]';
      }

      // Check if message has multi-device encryption
      if (message.senderEncryptedVersions && message.senderEncryptedVersions.length > 0) {
        // Try to decrypt from sender's versions first (if current user is sender)
        const decryptedFromSender = await decryptMessageFromDevices(
          message.senderEncryptedVersions,
          deviceId,
          keys.privateKey
        );

        // If successfully decrypted from sender's versions, return it
        if (decryptedFromSender && !decryptedFromSender.startsWith('[')) {
          return decryptedFromSender;
        }
      }

      if (message.recipientEncryptedVersions && message.recipientEncryptedVersions.length > 0) {
        // Try to decrypt from recipient's versions (if current user is recipient)
        const decryptedFromRecipient = await decryptMessageFromDevices(
          message.recipientEncryptedVersions,
          deviceId,
          keys.privateKey
        );

        return decryptedFromRecipient;
      }

      // Fallback to legacy decryption methods
      if (message.encryptedContentSender || message.encryptedContentRecipient) {
        // This is a legacy message format - handle it differently
        return '[Legacy message format - use legacy decryption]';
      }

      return '[Message format not recognized]';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to decrypt message';
      setError(errorMessage);
      return `[Decryption error: ${errorMessage}]`;
    }
  }, []);

  return {
    encryptForMultiDevice,
    decryptMultiDeviceMessage,
    loading,
    error,
  };
}

/**
 * Example usage in a component:
 *
 * ```typescript
 * import { useMultiDeviceEncryption } from '@/hooks/useMultiDeviceEncryption';
 *
 * function ChatComponent({ recipientId }: { recipientId: string }) {
 *   const { encryptForMultiDevice, decryptMultiDeviceMessage } = useMultiDeviceEncryption();
 *
 *   const sendMessage = async (messageText: string) => {
 *     try {
 *       // Encrypt for all devices
 *       const encrypted = await encryptForMultiDevice(messageText, recipientId);
 *
 *       // Send to backend
 *       await messageApi.send({
 *         conversationId: 'conversation-id',
 *         ...encrypted,
 *       });
 *     } catch (error) {
 *       console.error('Failed to send message:', error);
 *     }
 *   };
 *
 *   const displayMessage = async (message: Message) => {
 *     const decrypted = await decryptMultiDeviceMessage(message);
 *     return decrypted;
 *   };
 *
 *   return (
 *     // Your component JSX
 *   );
 * }
 * ```
 */