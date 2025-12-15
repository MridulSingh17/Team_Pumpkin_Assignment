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
}

export {};

