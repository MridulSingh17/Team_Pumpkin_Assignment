/**
 * Polyfills for React Native environment
 * This file sets up global functions needed for Buffer and other utilities
 */

import * as Crypto from "expo-crypto";

// Polyfill for crypto.getRandomValues (required by @noble/curves)
if (typeof global.crypto === "undefined") {
  (global as any).crypto = {};
}

if (typeof global.crypto.getRandomValues === "undefined") {
  global.crypto.getRandomValues = function <T extends ArrayBufferView | null>(
    array: T
  ): T {
    if (array === null) {
      throw new TypeError(
        "Failed to execute 'getRandomValues' on 'Crypto': parameter 1 is not of type 'ArrayBufferView'."
      );
    }

    // Get random bytes from expo-crypto
    const randomBytes = Crypto.getRandomBytes(array.byteLength);
    
    // Copy bytes into the provided array buffer view
    const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < view.length; i++) {
      view[i] = randomBytes[i];
    }

    return array;
  };
}

// Base64 encoding/decoding characters
const base64Chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Polyfill for base64FromArrayBuffer - pure implementation to avoid circular dependency
if (typeof global.base64FromArrayBuffer === "undefined") {
    global.base64FromArrayBuffer = function (arrayBuffer: ArrayBuffer): string {
        const bytes = new Uint8Array(arrayBuffer);
        let result = "";
        let i;

        for (i = 0; i < bytes.length; i += 3) {
            const byte1 = bytes[i];
            const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
            const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

            const encoded1 = byte1 >> 2;
            const encoded2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
            const encoded3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
            const encoded4 = byte3 & 0x3f;

            result += base64Chars[encoded1];
            result += base64Chars[encoded2];
            result += i + 1 < bytes.length ? base64Chars[encoded3] : "=";
            result += i + 2 < bytes.length ? base64Chars[encoded4] : "=";
        }

        return result;
    };
}

// Polyfill for arrayBufferFromBase64 - pure implementation to avoid circular dependency
if (typeof global.arrayBufferFromBase64 === "undefined") {
    global.arrayBufferFromBase64 = function (base64: string): ArrayBuffer {
        // Remove padding
        const base64Clean = base64.replace(/=/g, "");
        const length = base64Clean.length;
        const bufferLength = (length * 3) / 4;
        const bytes = new Uint8Array(bufferLength);

        let p = 0;
        for (let i = 0; i < length; i += 4) {
            const encoded1 = base64Chars.indexOf(base64Clean[i]);
            const encoded2 = base64Chars.indexOf(base64Clean[i + 1]);
            const encoded3 = base64Chars.indexOf(base64Clean[i + 2]);
            const encoded4 = base64Chars.indexOf(base64Clean[i + 3]);

            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            if (encoded3 !== -1) {
                bytes[p++] = ((encoded2 & 0x0f) << 4) | (encoded3 >> 2);
            }
            if (encoded4 !== -1) {
                bytes[p++] = ((encoded3 & 0x03) << 6) | encoded4;
            }
        }

        return bytes.buffer;
    };
}

// Alias for base64ToArrayBuffer (expected by @craftzdog/react-native-buffer)
if (typeof global.base64ToArrayBuffer === "undefined") {
    global.base64ToArrayBuffer = global.arrayBufferFromBase64;
}

// Export to ensure the file is imported
export {};
