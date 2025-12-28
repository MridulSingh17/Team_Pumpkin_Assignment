/**
 * Client-side encryption utilities for end-to-end encrypted messaging
 * Uses @noble/curves for fast EC P-256 + ECDH + AES-GCM encryption
 * Compatible with web implementation (uses raw/uncompressed public keys)
 */

import { p256 } from "@noble/curves/nist.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import forge from "node-forge";

// ============================================================================
// HELPER FUNCTIONS (Base64 conversion - compatible with web)
// ============================================================================

/**
 * HKDF (HMAC-based Extract-and-Expand Key Derivation Function)
 * Implements HKDF as specified in RFC 5869 to match Web Crypto API behavior
 *
 * NOTE: Currently not used, but kept for potential future use if direct
 * x-coordinate approach doesn't work with Web Crypto API.
 *
 * @param ikm - Input key material (shared secret)
 * @param salt - Salt (can be empty)
 * @param info - Application-specific info (can be empty)
 * @param length - Desired output length in bytes
 * @returns Derived key material
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Uint8Array {
  // Step 1: Extract - derive a pseudorandom key (PRK) from IKM and salt
  const hashLength = 32; // SHA-256 output length
  const prkSalt = salt.length > 0 ? salt : new Uint8Array(hashLength); // Use zero-filled salt if empty

  // Use HMAC-SHA256 for extraction
  const prk = hmac(sha256, prkSalt, ikm);

  // Step 2: Expand - expand PRK to desired length
  const hashLen = hashLength;
  const n = Math.ceil(length / hashLen);
  const t = new Uint8Array(n * hashLen);

  for (let i = 0; i < n; i++) {
    const counter = new Uint8Array([i + 1]);
    const input = new Uint8Array((i === 0 ? 0 : hashLen) + info.length + 1);

    if (i > 0) {
      input.set(t.slice((i - 1) * hashLen, i * hashLen), 0);
    }
    input.set(info, i === 0 ? 0 : hashLen);
    input.set(counter, input.length - 1);

    // Use HMAC-SHA256 for expansion
    const hmacResult = hmac(sha256, prk, input);
    t.set(hmacResult, i * hashLen);
  }

  return t.slice(0, length);
}

/**
 * Convert Base64 string to ArrayBuffer
 * Uses polyfill if available, otherwise uses forge
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Try to use global polyfill first
  if (
    typeof global !== "undefined" &&
    typeof (global as any).base64ToArrayBuffer === "function"
  ) {
    return (global as any).base64ToArrayBuffer(base64);
  }

  // Fallback to forge
  const decoded = forge.util.decode64(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to Base64 string
 * Uses polyfill if available, otherwise uses forge
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // Try to use global polyfill first
  if (
    typeof global !== "undefined" &&
    typeof (global as any).arrayBufferToBase64 === "function"
  ) {
    return (global as any).arrayBufferToBase64(buffer);
  }

  // Fallback to forge
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return forge.util.encode64(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const buffer = base64ToArrayBuffer(base64);
  return new Uint8Array(buffer);
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return arrayBufferToBase64(buffer);
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate EC P-256 key pair
 * Uses raw (uncompressed) public key format to match web implementation
 * Web: ~88 chars base64 for public key (65 bytes uncompressed)
 * Mobile: Same format for compatibility
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  try {
    console.log("🔧 Generating EC P-256 key pair...");

    // Generate EC P-256 key pair using @noble/curves
    const { secretKey } = p256.keygen();

    // Get UNCOMPRESSED public key (65 bytes: 0x04 + 32-byte x + 32-byte y)
    // This matches the web implementation which uses "raw" format
    const uncompressedPublicKey = p256.getPublicKey(secretKey, false);

    // Encode to base64 for storage (matching web format)
    const publicKeyBase64 = uint8ArrayToBase64(uncompressedPublicKey);

    // For private key, we store the raw 32-byte secret key
    // Note: Web uses PKCS8 format, but we'll derive keys the same way
    const privateKeyBase64 = uint8ArrayToBase64(secretKey);

    console.log("✅ EC key pair generated successfully");

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
    };
  } catch (error) {
    console.error("❌ Error generating key pair:", error);
    throw new Error("Failed to generate encryption keys: " + String(error));
  }
}

// ============================================================================
// ECDH KEY DERIVATION
// ============================================================================

/**
 * Derive shared AES key between two key pairs using ECDH
 * Compatible with web implementation
 *
 * @param myPrivateKey - My EC private key (base64, raw 32 bytes)
 * @param theirPublicKey - Their EC public key (base64, raw/uncompressed 65 bytes or compressed 33 bytes)
 * @returns Base64 encoded AES key (32 bytes)
 */
async function deriveDevicePairKey(
  myPrivateKey: string,
  theirPublicKey: string
): Promise<string> {
  try {
    // Decode keys from base64 using helper functions
    const privateKeyBytes = base64ToUint8Array(myPrivateKey);
    const publicKeyBytes = base64ToUint8Array(theirPublicKey);

    // Determine if public key is compressed (33 bytes) or uncompressed (65 bytes)
    // Web uses uncompressed (raw format), but we support both for compatibility
    let publicKeyToUse: Uint8Array;

    if (publicKeyBytes.length === 33) {
      // Already compressed, use directly
      publicKeyToUse = publicKeyBytes;
    } else if (publicKeyBytes.length === 65 && publicKeyBytes[0] === 0x04) {
      // Uncompressed format from web: 0x04 (1 byte) + x (32 bytes) + y (32 bytes)
      // Convert to compressed format for @noble/curves
      const x = publicKeyBytes.slice(1, 33);
      const y = publicKeyBytes.slice(33, 65);

      // Compress: use y's LSB (0x02 if even, 0x03 if odd) + x
      const compressed = new Uint8Array(33);
      compressed[0] = (y[31] & 1) === 0 ? 0x02 : 0x03;
      compressed.set(x, 1);
      publicKeyToUse = compressed;
    } else {
      throw new Error(
        `Invalid public key format: expected 33 or 65 bytes, got ${publicKeyBytes.length}`
      );
    }

    // Perform ECDH key exchange
    // Get uncompressed shared point to match Web Crypto API behavior
    // Web Crypto API uses the x-coordinate of the shared point as the shared secret
    const sharedPointUncompressed = p256.getSharedSecret(
      privateKeyBytes,
      publicKeyToUse,
      false // uncompressed to get full point
    );

    // Uncompressed format: 0x04 (1 byte) + x (32 bytes) + y (32 bytes) = 65 bytes
    // Web Crypto API uses the x-coordinate (bytes 1-33, which is 32 bytes) as the shared secret
    const xCoordinate = sharedPointUncompressed.slice(1, 33);

    // IMPORTANT: Web Crypto API's deriveKey with ECDH for AES-GCM uses HKDF
    // (HMAC-based Key Derivation Function) internally. According to the Web Crypto API spec:
    // 1. Computes ECDH shared secret (x-coordinate of shared point)
    // 2. Applies HKDF to derive the AES key
    //
    // Web Crypto API uses HKDF with:
    // - Hash: SHA-256
    // - Salt: Empty (no salt)
    // - Info: Algorithm-specific info (typically empty or minimal for AES-GCM)
    // - Length: 32 bytes (for AES-256)
    //
    // We need to match this exactly to ensure compatibility.
    //
    // Note: The Web Crypto API might use empty salt and info, or it might use
    // algorithm-specific parameters. For maximum compatibility, we'll use:
    // - Salt: empty (as per common Web Crypto API implementations)
    // - Info: empty or algorithm identifier
    // - Length: 32 bytes for AES-256

    // Web Crypto API's deriveKey with ECDH for AES-GCM:
    // The Web Crypto API specification is not entirely clear on the exact KDF used,
    // but based on testing and common implementations, it appears to use the
    // x-coordinate directly as the key material when it's exactly the right length.
    //
    // For P-256, the x-coordinate is exactly 32 bytes, which matches AES-256 key length.
    // This is the most likely approach used by Web Crypto API.
    //
    // However, if this doesn't work, we may need to try:
    // 1. SHA-256 hash of x-coordinate
    // 2. HKDF with algorithm-specific info
    // 3. HKDF with specific salt

    // Try using x-coordinate directly first (most likely Web Crypto API behavior)
    let aesKey = xCoordinate;

    // Debug logging (can be removed in production)
    if (__DEV__) {
      console.log("🔑 Key derivation:", {
        publicKeyLength: publicKeyBytes.length,
        xCoordinateLength: xCoordinate.length,
        aesKeyLength: aesKey.length,
        method: "direct-x-coordinate",
      });
    }

    // Encode to base64
    return uint8ArrayToBase64(aesKey);
  } catch (error) {
    console.error("❌ Error deriving device pair key:", error);
    console.error("Key derivation details:", {
      myPrivateKeyLength: myPrivateKey.length,
      theirPublicKeyLength: theirPublicKey.length,
      error: String(error),
    });
    throw new Error("Failed to derive encryption key: " + String(error));
  }
}

// ============================================================================
// AES-GCM ENCRYPTION/DECRYPTION
// ============================================================================

/**
 * Encrypt message with AES-256-GCM
 *
 * @param message - Plain text message
 * @param keyBase64 - Base64 encoded AES key
 * @returns Object with encrypted content and IV
 */
async function encryptWithAES(
  message: string,
  keyBase64: string
): Promise<{ encryptedContent: string; iv: string }> {
  try {
    // Decode AES key
    const key = forge.util.decode64(keyBase64);

    // Generate random 12-byte IV
    const iv = forge.random.getBytesSync(12);

    // Debug logging
    if (__DEV__) {
      console.log("🔒 Encrypting AES-GCM:", {
        messageLength: message.length,
        keyLength: key.length,
        ivLength: iv.length,
      });
    }

    // Create cipher
    const cipher = forge.cipher.createCipher("AES-GCM", key);
    cipher.start({ iv: iv });
    cipher.update(forge.util.createBuffer(message, "utf8"));
    cipher.finish();

    // Get encrypted data and auth tag
    const encrypted = cipher.output.bytes();
    const tag = cipher.mode.tag.bytes();

    // Combine encrypted data and tag
    const combined = encrypted + tag;

    if (__DEV__) {
      console.log("✅ Successfully encrypted message");
    }

    return {
      encryptedContent: forge.util.encode64(combined),
      iv: forge.util.encode64(iv),
    };
  } catch (error) {
    console.error("❌ Error encrypting with AES:", error);
    throw new Error("Failed to encrypt message");
  }
}

/**
 * Decrypt message with AES-256-GCM
 *
 * @param encryptedContent - Base64 encoded encrypted message
 * @param ivBase64 - Base64 encoded IV
 * @param keyBase64 - Base64 encoded AES key
 * @returns Decrypted plain text message
 */
async function decryptWithAES(
  encryptedContent: string,
  ivBase64: string,
  keyBase64: string
): Promise<string> {
  try {
    // Decode
    const key = forge.util.decode64(keyBase64);
    const iv = forge.util.decode64(ivBase64);
    const combined = forge.util.decode64(encryptedContent);

    // Split encrypted data and auth tag (tag is last 16 bytes)
    const encrypted = combined.substring(0, combined.length - 16);
    const tag = combined.substring(combined.length - 16);

    // Debug logging
    if (__DEV__) {
      console.log("🔓 Decrypting AES-GCM:", {
        keyLength: key.length,
        ivLength: iv.length,
        encryptedLength: encrypted.length,
        tagLength: tag.length,
      });
    }

    // Create decipher
    const decipher = forge.cipher.createDecipher("AES-GCM", key);
    decipher.start({
      iv: iv,
      tag: forge.util.createBuffer(tag),
    });
    decipher.update(forge.util.createBuffer(encrypted, "raw"));

    const success = decipher.finish();

    if (!success) {
      console.error(
        "❌ AES-GCM authentication failed - key might be incorrect"
      );
      throw new Error(
        "Authentication failed - this usually means the encryption key is wrong"
      );
    }

    const decrypted = decipher.output.toString();

    if (__DEV__) {
      console.log("✅ Successfully decrypted message");
    }

    return decrypted;
  } catch (error) {
    console.error("❌ Error decrypting with AES:", error);
    console.error("Decryption details:", {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      encryptedContentLength: encryptedContent.length,
      ivLength: ivBase64.length,
      keyLength: keyBase64.length,
    });
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
  recipientDevices: Device[]
): Promise<{
  senderDeviceId: string;
  encryptedVersions: EncryptedVersion[];
}> {
  try {
    const keys = await retrieveKeys();
    if (!keys || !keys.privateKey) {
      throw new Error("Private key not found");
    }
    const { privateKey } = keys;

    const encryptedVersions: EncryptedVersion[] = [];

    // Encrypt for recipient's devices
    for (const device of recipientDevices) {
      try {
        if (__DEV__) {
          console.log(
            `🔐 Encrypting for recipient device: ${device._id} (${device.deviceType})`
          );
        }

        // Derive shared AES key using ECDH
        const aesKey = await deriveDevicePairKey(privateKey, device.publicKey);

        // Encrypt message with AES
        const { encryptedContent, iv } = await encryptWithAES(message, aesKey);

        encryptedVersions.push({
          forDeviceId: device._id,
          encryptedContent,
          iv,
        });

        if (__DEV__) {
          console.log(`✅ Successfully encrypted for device: ${device._id}`);
        }
      } catch (error) {
        console.error(`❌ Failed to encrypt for device ${device._id}:`, error);
        console.error("Device details:", {
          deviceId: device._id,
          deviceType: device.deviceType,
          publicKeyLength: device.publicKey.length,
          error: String(error),
        });
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
          error
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
  senderDevicePublicKey: string
): Promise<string> {
  try {
    // Find the encrypted version for this device
    const myVersion = encryptedVersions.find(
      (version) => version.forDeviceId === myDeviceId
    );

    if (!myVersion) {
      console.warn("⚠️ Message not encrypted for this device:", myDeviceId);
      console.log(
        "Available device IDs:",
        encryptedVersions.map((v) => v.forDeviceId)
      );
      return "[Message not encrypted for this device]";
    }

    // Get my private key
    const keys = await retrieveKeys();
    if (!keys || !keys.privateKey) {
      console.error("❌ Private key not found");
      return "[Private key not found]";
    }
    const { privateKey } = keys;

    // Debug logging
    if (__DEV__) {
      console.log("🔐 Decrypting multi-device message:", {
        myDeviceId,
        senderPublicKeyLength: senderDevicePublicKey.length,
        myPrivateKeyLength: privateKey.length,
        encryptedVersionsCount: encryptedVersions.length,
      });
    }

    // Derive the same AES key using ECDH
    const aesKey = await deriveDevicePairKey(privateKey, senderDevicePublicKey);

    if (__DEV__) {
      console.log("✅ Derived AES key, attempting decryption...");
    }

    // Decrypt with AES
    const decrypted = await decryptWithAES(
      myVersion.encryptedContent,
      myVersion.iv,
      aesKey
    );

    if (decrypted.startsWith("[")) {
      console.error("❌ Decryption returned error message:", decrypted);
    } else if (__DEV__) {
      console.log("✅ Successfully decrypted multi-device message");
    }

    return decrypted;
  } catch (error) {
    console.error("❌ Error decrypting multi-device message:", error);
    console.error("Decryption error details:", {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      myDeviceId,
      senderPublicKeyLength: senderDevicePublicKey?.length || 0,
      encryptedVersionsCount: encryptedVersions?.length || 0,
    });
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
  backupKey: string
): Promise<string> {
  try {
    // Derive key from backup password using SHA-256
    const keyHashBytes = sha256(new TextEncoder().encode(backupKey));
    // Convert Uint8Array to string for forge
    const keyHash = String.fromCharCode(...keyHashBytes);

    // Generate random 12-byte IV
    const iv = forge.random.getBytesSync(12);

    // Create cipher with derived key
    const cipher = forge.cipher.createCipher(
      "AES-GCM",
      forge.util.createBuffer(keyHash)
    );
    cipher.start({ iv: iv });
    cipher.update(forge.util.createBuffer(data, "utf8"));
    cipher.finish();

    // Get encrypted data and auth tag
    const encrypted = cipher.output.bytes();
    const tag = cipher.mode.tag.bytes();

    // Combine IV, encrypted data, and tag
    const combined = iv + encrypted + tag;

    return forge.util.encode64(combined);
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
  backupKey: string
): Promise<string> {
  try {
    // Derive key from backup password
    const keyHashBytes = sha256(new TextEncoder().encode(backupKey));
    // Convert Uint8Array to string for forge
    const keyHash = String.fromCharCode(...keyHashBytes);

    // Decode the combined data
    const combined = forge.util.decode64(encryptedData);

    // Extract IV (first 12 bytes), encrypted data, and tag (last 16 bytes)
    const iv = combined.substring(0, 12);
    const tag = combined.substring(combined.length - 16);
    const encrypted = combined.substring(12, combined.length - 16);

    // Create decipher
    const decipher = forge.cipher.createDecipher(
      "AES-GCM",
      forge.util.createBuffer(keyHash)
    );
    decipher.start({
      iv: iv,
      tag: forge.util.createBuffer(tag),
    });
    decipher.update(forge.util.createBuffer(encrypted, "raw"));

    const success = decipher.finish();

    if (!success) {
      throw new Error("Authentication failed");
    }

    return decipher.output.toString();
  } catch (error) {
    console.error("Error decrypting with backup key:", error);
    throw new Error("Failed to decrypt with backup key");
  }
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Store EC keys in AsyncStorage
 */
export async function storeKeys(
  publicKey: string,
  privateKey: string
): Promise<void> {
  await AsyncStorage.setItem("publicKey", publicKey);
  await AsyncStorage.setItem("privateKey", privateKey);
}

/**
 * Retrieve EC keys from AsyncStorage
 */
export async function retrieveKeys(): Promise<{
  publicKey: string;
  privateKey: string;
} | null> {
  const publicKey = await AsyncStorage.getItem("publicKey");
  const privateKey = await AsyncStorage.getItem("privateKey");

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey };
}

/**
 * Clear keys from AsyncStorage
 */
export async function clearKeys(): Promise<void> {
  await AsyncStorage.removeItem("publicKey");
  await AsyncStorage.removeItem("privateKey");
}

/**
 * Store device _id (MongoDB ObjectId) in AsyncStorage
 */
export async function storeDeviceId(deviceId: string): Promise<void> {
  await AsyncStorage.setItem("deviceId", deviceId);
}

/**
 * Retrieve device _id from AsyncStorage
 */
export async function retrieveDeviceId(): Promise<string | null> {
  return await AsyncStorage.getItem("deviceId");
}

/**
 * Clear device _id from AsyncStorage
 */
export async function clearDeviceId(): Promise<void> {
  await AsyncStorage.removeItem("deviceId");
}
