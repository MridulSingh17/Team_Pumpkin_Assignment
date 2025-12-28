/**
 * Client-side encryption utilities for end-to-end encrypted messaging
 * Uses Web Crypto API for EC (P-256) + ECDH + AES-GCM encryption
 *
 * Architecture:
 * - Each device has an EC P-256 key pair (much smaller and faster than RSA)
 * - ECDH (Elliptic Curve Diffie-Hellman) derives shared secrets between device pairs
 * - AES-256-GCM encrypts messages (fast, unlimited size, authenticated)
 * - Each message encrypted for multiple devices using pairwise ECDH
 */

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate EC P-256 key pair
 * ~44 chars base64 for public key (vs ~390 for RSA-2048)
 * 1-5ms generation time (vs 50-200ms for RSA)
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256", // NIST P-256 curve (widely supported)
      },
      true, // extractable
      ["deriveKey", "deriveBits"],
    );

    // Export public key as raw format (uncompressed point)
    const publicKeyBuffer = await window.crypto.subtle.exportKey(
      "raw",
      keyPair.publicKey,
    );

    // Export private key as PKCS8 format
    const privateKeyBuffer = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey,
    );

    return {
      publicKey: arrayBufferToBase64(publicKeyBuffer), // ~88 chars
      privateKey: arrayBufferToBase64(privateKeyBuffer), // ~121 chars
    };
  } catch (error) {
    console.error("Error generating EC key pair:", error);
    throw new Error("Failed to generate encryption keys");
  }
}

/**
 * Import EC public key from base64 string
 */
async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  try {
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    return await window.crypto.subtle.importKey(
      "raw",
      publicKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      [], // public keys don't need usages for ECDH
    );
  } catch (error) {
    console.error("Error importing public key:", error);
    throw new Error("Failed to import public key");
  }
}

/**
 * Import EC private key from base64 string
 */
async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  try {
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    return await window.crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey", "deriveBits"],
    );
  } catch (error) {
    console.error("Error importing private key:", error);
    throw new Error("Failed to import private key");
  }
}

// ============================================================================
// ECDH KEY DERIVATION
// ============================================================================

/**
 * Derive shared AES key between two EC key pairs using ECDH
 * Both parties can derive the SAME key without transmitting it!
 *
 * @param myPrivateKey - My EC private key (base64)
 * @param theirPublicKey - Their EC public key (base64)
 * @returns CryptoKey - AES-256-GCM key for encryption/decryption
 */
async function deriveDevicePairKey(
  myPrivateKey: string,
  theirPublicKey: string,
): Promise<CryptoKey> {
  try {
    // Import keys
    const privateKey = await importPrivateKey(myPrivateKey);
    const publicKey = await importPublicKey(theirPublicKey);

    // Derive shared secret using ECDH
    // This produces the SAME secret for both parties:
    // ECDH(myPrivate, theirPublic) === ECDH(theirPrivate, myPublic)
    const sharedSecret = await window.crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: publicKey,
      },
      privateKey,
      {
        name: "AES-GCM",
        length: 256, // AES-256
      },
      false, // not extractable (more secure)
      ["encrypt", "decrypt"],
    );

    return sharedSecret;
  } catch (error) {
    console.error("Error deriving device pair key:", error);
    throw new Error("Failed to derive encryption key");
  }
}

// ============================================================================
// AES-GCM ENCRYPTION/DECRYPTION
// ============================================================================

/**
 * Encrypt message with AES-256-GCM
 *
 * @param message - Plain text message
 * @param key - AES key (from ECDH derivation)
 * @returns Object with encrypted content and IV
 */
async function encryptWithAES(
  message: string,
  key: CryptoKey,
): Promise<{ encryptedContent: string; iv: string }> {
  try {
    // Generate random 12-byte IV (initialization vector)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encode message to bytes
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);

    // Encrypt with AES-GCM
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128, // authentication tag length
      },
      key,
      messageBuffer,
    );

    return {
      encryptedContent: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv.buffer),
    };
  } catch (error) {
    console.error("Error encrypting with AES:", error);
    throw new Error("Failed to encrypt message");
  }
}

/**
 * Decrypt message with AES-256-GCM
 *
 * @param encryptedContent - Encrypted message (base64)
 * @param iv - Initialization vector (base64)
 * @param key - AES key (from ECDH derivation)
 * @returns Decrypted plain text message
 */
async function decryptWithAES(
  encryptedContent: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  try {
    // Decode from base64
    const encryptedBuffer = base64ToArrayBuffer(encryptedContent);
    const ivBuffer = base64ToArrayBuffer(iv);

    // Decrypt with AES-GCM
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
        tagLength: 128,
      },
      key,
      encryptedBuffer,
    );

    // Decode bytes to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error("Error decrypting with AES:", error);
    return "[Failed to decrypt message]";
  }
}

// ============================================================================
// MULTI-DEVICE ENCRYPTION
// ============================================================================

export interface Device {
  _id: string;
  deviceId: string;
  publicKey: string;
  deviceType: "web" | "ios" | "android";
}

export interface EncryptedVersion {
  forDeviceId: string;
  encryptedContent: string;
  iv: string;
}

/**
 * Prepare message for multiple devices using ECDH + AES
 *
 * Flow:
 * 1. For each target device, derive AES key using ECDH(myPrivate, theirPublic)
 * 2. Encrypt message with derived AES key
 * 3. Store encrypted version with device ID
 *
 * Multi-device support:
 * - Current device: Stores plaintext locally (no encryption needed)
 * - Other sender devices: Encrypt so they can decrypt when fetching from backend
 * - All recipient devices: Encrypt so they can decrypt when receiving
 *
 * @param message - Plain text message
 * @param senderDeviceId - Current device's _id (MongoDB ObjectId)
 * @param senderDevices - Sender's OTHER devices (excluding current - for multi-device sync)
 * @param recipientDevices - ALL recipient's devices
 * @returns Object ready to send to backend
 */
export async function prepareMultiDeviceMessage(
  message: string,
  senderDeviceId: string,
  senderDevices: Device[],
  recipientDevices: Device[],
): Promise<{
  senderDeviceId: string;
  encryptedVersions: EncryptedVersion[];
}> {
  try {
    const keys = retrieveKeys();
    if (!keys || !keys.privateKey) {
      throw new Error("Private key not found");
    }
    const { privateKey } = keys;

    const encryptedVersions: EncryptedVersion[] = [];

    // Encrypt for recipient's devices
    for (const device of recipientDevices) {
      try {
        // Derive shared AES key using ECDH
        const aesKey = await deriveDevicePairKey(privateKey, device.publicKey);

        // Encrypt message with AES
        const { encryptedContent, iv } = await encryptWithAES(message, aesKey);

        encryptedVersions.push({
          forDeviceId: device._id, // Use MongoDB _id
          encryptedContent,
          iv,
        });
      } catch (error) {
        console.error(`Failed to encrypt for device ${device._id}:`, error);
        // Continue with other devices even if one fails
      }
    }

    // Encrypt for sender's OTHER devices (excluding current device)
    // Current device stores plaintext locally, no need to encrypt for itself
    // Other devices will decrypt when fetching from backend
    for (const device of senderDevices) {
      try {
        const aesKey = await deriveDevicePairKey(privateKey, device.publicKey);
        const { encryptedContent, iv } = await encryptWithAES(message, aesKey);

        encryptedVersions.push({
          forDeviceId: device._id,
          encryptedContent,
          iv,
        });
      } catch (error) {
        console.error(
          `Failed to encrypt for sender device ${device._id}:`,
          error,
        );
      }
    }

    if (encryptedVersions.length === 0) {
      throw new Error("Failed to encrypt message for any device");
    }

    return {
      senderDeviceId,
      encryptedVersions,
    };
  } catch (error) {
    console.error("Error preparing multi-device message:", error);
    throw new Error("Failed to prepare encrypted message");
  }
}

/**
 * Decrypt message from device-specific encrypted versions
 *
 * @param encryptedVersions - Array of encrypted versions
 * @param myDeviceId - Current device's _id (MongoDB ObjectId)
 * @param senderDevicePublicKey - Sender device's public key
 * @returns Decrypted plain text message
 */
export async function decryptMultiDeviceMessage(
  encryptedVersions: EncryptedVersion[],
  myDeviceId: string,
  senderDevicePublicKey: string,
): Promise<string> {
  try {
    // Find the encrypted version for this device
    const myVersion = encryptedVersions.find(
      (version) => version.forDeviceId === myDeviceId,
    );

    if (!myVersion) {
      return "[Message not encrypted for this device]";
    }

    // Get my private key
    const keys = retrieveKeys();
    if (!keys || !keys.privateKey) {
      return "[Private key not found]";
    }
    const { privateKey } = keys;

    // Derive the same AES key using ECDH
    const aesKey = await deriveDevicePairKey(privateKey, senderDevicePublicKey);

    // Decrypt with AES
    return await decryptWithAES(
      myVersion.encryptedContent,
      myVersion.iv,
      aesKey,
    );
  } catch (error) {
    console.error("Error decrypting multi-device message:", error);
    return "[Failed to decrypt message]";
  }
}

// ============================================================================
// BACKUP/EXPORT ENCRYPTION (Optional - for data export feature)
// ============================================================================

/**
 * Encrypt data with backup key (for export/import)
 * Uses password-based encryption with AES-GCM
 */
export async function encryptWithBackupKey(
  data: string,
  backupKey: string,
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const keyBuffer = encoder.encode(backupKey);

    // Derive key from backup password using SHA-256
    const keyHash = await window.crypto.subtle.digest("SHA-256", keyBuffer);

    // Import as AES key
    const importedKey = await window.crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    // Generate IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      importedKey,
      dataBuffer,
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error("Error encrypting with backup key:", error);
    throw new Error("Failed to encrypt with backup key");
  }
}

/**
 * Decrypt data with backup key (for export/import)
 */
export async function decryptWithBackupKey(
  encryptedData: string,
  backupKey: string,
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(backupKey);

    // Derive key from backup password
    const keyHash = await window.crypto.subtle.digest("SHA-256", keyBuffer);

    const importedKey = await window.crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // Decode the combined data
    const combined = base64ToArrayBuffer(encryptedData);
    const iv = combined.slice(0, 12);
    const encryptedBuffer = combined.slice(12);

    // Decrypt
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      importedKey,
      encryptedBuffer,
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("Error decrypting with backup key:", error);
    throw new Error("Failed to decrypt with backup key");
  }
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Store EC keys in localStorage
 */
export function storeKeys(publicKey: string, privateKey: string): void {
  localStorage.setItem("publicKey", publicKey);
  localStorage.setItem("privateKey", privateKey);
}

/**
 * Retrieve EC keys from localStorage
 */
export function retrieveKeys(): {
  publicKey: string;
  privateKey: string;
} | null {
  const publicKey = localStorage.getItem("publicKey");
  const privateKey = localStorage.getItem("privateKey");

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey };
}

/**
 * Clear keys from localStorage
 */
export function clearKeys(): void {
  localStorage.removeItem("publicKey");
  localStorage.removeItem("privateKey");
}

/**
 * Store device _id (MongoDB ObjectId) in localStorage
 */
export function storeDeviceId(deviceId: string): void {
  localStorage.setItem("deviceId", deviceId);
}

/**
 * Retrieve device _id from localStorage
 */
export function retrieveDeviceId(): string | null {
  return localStorage.getItem("deviceId");
}

/**
 * Clear device _id from localStorage
 */
export function clearDeviceId(): void {
  localStorage.removeItem("deviceId");
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
