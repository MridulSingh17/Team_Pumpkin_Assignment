/**
 * Client-side encryption utilities for end-to-end encrypted messaging
 * Uses Web Crypto API for RSA and AES encryption
 */

// Generate RSA key pair for asymmetric encryption
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey: arrayBufferToBase64(publicKey),
      privateKey: arrayBufferToBase64(privateKey),
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw new Error('Failed to generate encryption keys');
  }
}

// Import public key from base64 string
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  try {
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    return await window.crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['encrypt']
    );
  } catch (error) {
    console.error('Error importing public key:', error);
    throw new Error('Failed to import public key');
  }
}

// Import private key from base64 string
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  try {
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    return await window.crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['decrypt']
    );
  } catch (error) {
    console.error('Error importing private key:', error);
    throw new Error('Failed to import private key');
  }
}

// Encrypt message with recipient's public key
export async function encryptMessage(message: string, publicKeyBase64: string): Promise<string> {
  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    const encodedMessage = new TextEncoder().encode(message);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      encodedMessage
    );

    return arrayBufferToBase64(encryptedBuffer);
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw new Error('Failed to encrypt message');
  }
}

// Decrypt message with own private key
export async function decryptMessage(encryptedMessage: string, privateKeyBase64: string): Promise<string> {
  try {
    const privateKey = await importPrivateKey(privateKeyBase64);
    const encryptedBuffer = base64ToArrayBuffer(encryptedMessage);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Error decrypting message:', error);
    // Don't throw, return a user-friendly message instead
    return '[Message encrypted with different key - cannot decrypt]';
  }
}

// Encrypt data with backup key (for export/import)
export async function encryptWithBackupKey(data: string, backupKey: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const keyBuffer = encoder.encode(backupKey);

    // Generate a key from the backup key
    const importedKey = await window.crypto.subtle.importKey(
      'raw',
      await window.crypto.subtle.digest('SHA-256', keyBuffer),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Generate IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      importedKey,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('Error encrypting with backup key:', error);
    throw new Error('Failed to encrypt with backup key');
  }
}

// Decrypt data with backup key (for export/import)
export async function decryptWithBackupKey(encryptedData: string, backupKey: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(backupKey);

    // Generate a key from the backup key
    const importedKey = await window.crypto.subtle.importKey(
      'raw',
      await window.crypto.subtle.digest('SHA-256', keyBuffer),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decode the combined data
    const combined = base64ToArrayBuffer(encryptedData);
    const iv = combined.slice(0, 12);
    const encryptedBuffer = combined.slice(12);

    // Decrypt
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      importedKey,
      encryptedBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Error decrypting with backup key:', error);
    throw new Error('Failed to decrypt with backup key');
  }
}

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Store keys in localStorage
export function storeKeys(publicKey: string, privateKey: string): void {
  localStorage.setItem('publicKey', publicKey);
  localStorage.setItem('privateKey', privateKey);
}

// Retrieve keys from localStorage
export function retrieveKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = localStorage.getItem('publicKey');
  const privateKey = localStorage.getItem('privateKey');

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey };
}

// Clear keys from localStorage
export function clearKeys(): void {
  localStorage.removeItem('publicKey');
  localStorage.removeItem('privateKey');
}

// Store device _id (MongoDB ObjectId) in localStorage
export function storeDeviceId(deviceId: string): void {
  localStorage.setItem('deviceId', deviceId);
}

// Retrieve device _id from localStorage
export function retrieveDeviceId(): string | null {
  return localStorage.getItem('deviceId');
}

// Clear device _id from localStorage
export function clearDeviceId(): void {
  localStorage.removeItem('deviceId');
}

// Multi-device encryption helper types
export interface DeviceEncryptedVersion {
  deviceId: string;
  encryptedContent: string;
}

export interface Device {
  _id: string;
  deviceId: string;
  publicKey: string;
  deviceType: 'web' | 'ios' | 'android';
}

/**
 * Encrypt a message for multiple devices
 * @param message - The plain text message to encrypt
 * @param devices - Array of devices with their public keys
 * @returns Array of encrypted versions, one for each device (uses device._id as deviceId)
 */
export async function encryptMessageForDevices(
  message: string,
  devices: Device[]
): Promise<DeviceEncryptedVersion[]> {
  try {
    const encryptedVersions: DeviceEncryptedVersion[] = [];

    for (const device of devices) {
      try {
        const encryptedContent = await encryptMessage(message, device.publicKey);
        encryptedVersions.push({
          deviceId: device._id, // Use MongoDB _id, not UUID deviceId
          encryptedContent,
        });
      } catch (error) {
        console.error(`Failed to encrypt for device ${device._id}:`, error);
        // Continue with other devices even if one fails
      }
    }

    if (encryptedVersions.length === 0) {
      throw new Error('Failed to encrypt message for any device');
    }

    return encryptedVersions;
  } catch (error) {
    console.error('Error encrypting message for devices:', error);
    throw new Error('Failed to encrypt message for devices');
  }
}

/**
 * Decrypt a message from device-specific encrypted versions
 * @param encryptedVersions - Array of encrypted versions
 * @param deviceId - Current device _id (MongoDB ObjectId)
 * @param privateKey - Private key for decryption
 * @returns Decrypted message or error message
 */
export async function decryptMessageFromDevices(
  encryptedVersions: DeviceEncryptedVersion[],
  deviceId: string,
  privateKey: string
): Promise<string> {
  try {
    // Find the encrypted version for this device (deviceId is device._id)
    const deviceVersion = encryptedVersions.find(
      (version) => version.deviceId === deviceId
    );

    if (!deviceVersion) {
      return '[Message not encrypted for this device]';
    }

    return await decryptMessage(deviceVersion.encryptedContent, privateKey);
  } catch (error) {
    console.error('Error decrypting message from devices:', error);
    return '[Failed to decrypt message]';
  }
}

/**
 * Prepare multi-device encrypted message data for sending
 * @param message - Plain text message
 * @param senderDevices - Array of sender's devices
 * @param recipientDevices - Array of recipient's devices
 * @param currentDeviceId - MongoDB _id of the device sending the message
 * @returns Object with encrypted versions for both sender and recipient
 */
export async function prepareMultiDeviceMessage(
  message: string,
  senderDevices: Device[],
  recipientDevices: Device[],
  currentDeviceId: string
): Promise<{
  senderDeviceId: string;
  senderEncryptedVersions: DeviceEncryptedVersion[];
  recipientEncryptedVersions: DeviceEncryptedVersion[];
}> {
  try {
    // Encrypt for all sender's devices (so they can see it on all devices)
    const senderEncryptedVersions = await encryptMessageForDevices(
      message,
      senderDevices
    );

    // Encrypt for all recipient's devices
    const recipientEncryptedVersions = await encryptMessageForDevices(
      message,
      recipientDevices
    );

    return {
      senderDeviceId: currentDeviceId, // This should be device._id (MongoDB ObjectId)
      senderEncryptedVersions,
      recipientEncryptedVersions,
    };
  } catch (error) {
    console.error('Error preparing multi-device message:', error);
    throw new Error('Failed to prepare multi-device message');
  }
}