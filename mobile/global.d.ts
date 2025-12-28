/**
 * Global type declarations for polyfills and extensions
 */

import { Buffer } from "@craftzdog/react-native-buffer";

declare global {
    var Buffer: typeof Buffer;
    
    /**
     * Converts an ArrayBuffer to a base64 string
     */
    function base64FromArrayBuffer(arrayBuffer: ArrayBuffer): string;
    
    /**
     * Converts a base64 string to an ArrayBuffer
     */
    function arrayBufferFromBase64(base64: string): ArrayBuffer;
    
    /**
     * Alias for arrayBufferFromBase64 (expected by @craftzdog/react-native-buffer)
     */
    function base64ToArrayBuffer(base64: string): ArrayBuffer;
    
    /**
     * Web Crypto API polyfill for React Native
     */
    var crypto: {
        getRandomValues: <T extends ArrayBufferView | null>(array: T) => T;
    };
}

export {};

