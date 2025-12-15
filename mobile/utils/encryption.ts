/**
 * Client-side encryption utilities for end-to-end encrypted messaging
 * Uses react-native-rsa-native for fast RSA key generation
 * Uses node-forge for RSA-OAEP encryption to match web implementation
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import forge from "node-forge";
import { RSA } from "react-native-rsa-native";

/**
 * Generate RSA key pair (2048-bit) using RSA-OAEP
 * Returns base64-encoded public and private keys compatible with Web Crypto API
 * Uses react-native-rsa-native for fast native key generation
 */
export async function generateKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
}> {
    try {
        // Try to use react-native-rsa-native (much faster than node-forge)
        // Fall back to node-forge if it fails or is not available
        let keys;

        // Check if RSA module is available (it can be null after hot reloads)
        if (RSA && typeof RSA.generateKeys === "function") {
            try {
                console.log(
                    "🔧 Starting RSA key pair generation with react-native-rsa-native..."
                );
                keys = await RSA.generateKeys(2048);
            } catch (nativeError) {
                console.warn(
                    "⚠️ react-native-rsa-native failed, falling back to node-forge:",
                    nativeError
                );
                console.log("🔧 Generating keys with node-forge (slower)...");

                // Fallback to node-forge
                const keypair = forge.pki.rsa.generateKeyPair({
                    bits: 2048,
                    workers: 0,
                });

                // Export to PEM format to match the native module's output
                keys = {
                    public: forge.pki.publicKeyToPem(keypair.publicKey),
                    private: forge.pki.privateKeyToPem(keypair.privateKey),
                };
            }
        } else {
            console.warn(
                "⚠️ react-native-rsa-native not available (likely due to hot reload), using node-forge"
            );
            console.log("🔧 Generating keys with node-forge (slower)...");

            // Fallback to node-forge
            const keypair = forge.pki.rsa.generateKeyPair({
                bits: 2048,
                workers: 0,
            });

            // Export to PEM format to match the native module's output
            keys = {
                public: forge.pki.publicKeyToPem(keypair.publicKey),
                private: forge.pki.privateKeyToPem(keypair.privateKey),
            };
        }

        console.log("🔧 Key pair generated, converting to DER format...");

        // react-native-rsa-native returns PEM format, we need to convert to DER and base64
        // to match the Web Crypto API format (SPKI for public, PKCS8 for private)

        // Parse PEM keys using node-forge
        const publicKeyForge = forge.pki.publicKeyFromPem(keys.public);
        const privateKeyForge = forge.pki.privateKeyFromPem(keys.private);

        // Convert to DER format (same as Web Crypto API)
        const publicKeyDer = forge.pki.publicKeyToAsn1(publicKeyForge);
        const privateKeyDer = forge.pki.privateKeyToAsn1(privateKeyForge);

        // Encode to base64
        const publicKeyBase64 = forge.util.encode64(
            forge.asn1.toDer(publicKeyDer).getBytes()
        );
        const privateKeyBase64 = forge.util.encode64(
            forge.asn1.toDer(privateKeyDer).getBytes()
        );

        console.log("🔧 Keys converted to base64 successfully");

        return {
            publicKey: publicKeyBase64,
            privateKey: privateKeyBase64,
        };
    } catch (error) {
        console.error("❌ Error generating key pair:", error);
        throw new Error("Failed to generate encryption keys: " + String(error));
    }
}

/**
 * Encrypt a message using RSA-OAEP with SHA-256
 * Compatible with Web Crypto API RSA-OAEP encryption
 * @param message - Plain text message to encrypt
 * @param publicKeyBase64 - Base64-encoded public key (SPKI format)
 * @returns Base64-encoded encrypted message
 */
export async function encryptMessage(
    message: string,
    publicKeyBase64: string
): Promise<string> {
    try {
        // Decode base64 public key
        const publicKeyDer = forge.util.decode64(publicKeyBase64);
        const publicKeyAsn1 = forge.asn1.fromDer(publicKeyDer);
        const publicKey = forge.pki.publicKeyFromAsn1(publicKeyAsn1);

        // Encrypt using RSA-OAEP with SHA-256
        const encrypted = publicKey.encrypt(message, "RSA-OAEP", {
            md: forge.md.sha256.create(),
            mgf1: {
                md: forge.md.sha256.create(),
            },
        });

        // Return base64-encoded encrypted message
        return forge.util.encode64(encrypted);
    } catch (error) {
        console.error("Error encrypting message:", error);
        throw new Error("Failed to encrypt message");
    }
}

/**
 * Decrypt a message using RSA-OAEP with SHA-256
 * Compatible with Web Crypto API RSA-OAEP decryption
 * @param encryptedMessage - Base64-encoded encrypted message
 * @param privateKeyBase64 - Base64-encoded private key (PKCS8 format)
 * @returns Decrypted plain text message
 */
export async function decryptMessage(
    encryptedMessage: string,
    privateKeyBase64: string
): Promise<string> {
    try {
        // Decode base64 private key
        const privateKeyDer = forge.util.decode64(privateKeyBase64);
        const privateKeyAsn1 = forge.asn1.fromDer(privateKeyDer);
        const privateKey = forge.pki.privateKeyFromAsn1(privateKeyAsn1);

        // Decode encrypted message
        const encrypted = forge.util.decode64(encryptedMessage);

        // Decrypt using RSA-OAEP with SHA-256
        const decrypted = privateKey.decrypt(encrypted, "RSA-OAEP", {
            md: forge.md.sha256.create(),
            mgf1: {
                md: forge.md.sha256.create(),
            },
        });

        return decrypted;
    } catch (error) {
        console.error("Error decrypting message:", error);
        return "[Message encrypted with different key - cannot decrypt]";
    }
}

// Store keys in AsyncStorage
export async function storeKeys(
    publicKey: string,
    privateKey: string
): Promise<void> {
    await AsyncStorage.setItem("publicKey", publicKey);
    await AsyncStorage.setItem("privateKey", privateKey);
}

// Retrieve keys from AsyncStorage
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

// Clear keys from AsyncStorage
export async function clearKeys(): Promise<void> {
    await AsyncStorage.removeItem("publicKey");
    await AsyncStorage.removeItem("privateKey");
}

// Store device _id (MongoDB ObjectId) in AsyncStorage
export async function storeDeviceId(deviceId: string): Promise<void> {
    await AsyncStorage.setItem("deviceId", deviceId);
}

// Retrieve device _id from AsyncStorage
export async function retrieveDeviceId(): Promise<string | null> {
    return await AsyncStorage.getItem("deviceId");
}

// Clear device _id from AsyncStorage
export async function clearDeviceId(): Promise<void> {
    await AsyncStorage.removeItem("deviceId");
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
    deviceType: "web" | "ios" | "android";
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
                const encryptedContent = await encryptMessage(
                    message,
                    device.publicKey
                );
                encryptedVersions.push({
                    deviceId: device._id, // Use MongoDB _id, not UUID deviceId
                    encryptedContent,
                });
            } catch (error) {
                console.error(
                    `Failed to encrypt for device ${device._id}:`,
                    error
                );
                // Continue with other devices even if one fails
            }
        }

        if (encryptedVersions.length === 0) {
            throw new Error("Failed to encrypt message for any device");
        }

        return encryptedVersions;
    } catch (error) {
        console.error("Error encrypting message for devices:", error);
        throw new Error("Failed to encrypt message for devices");
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
            return "[Message not encrypted for this device]";
        }

        return await decryptMessage(deviceVersion.encryptedContent, privateKey);
    } catch (error) {
        console.error("Error decrypting message from devices:", error);
        return "[Failed to decrypt message]";
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
        console.error("Error preparing multi-device message:", error);
        throw new Error("Failed to prepare multi-device message");
    }
}
