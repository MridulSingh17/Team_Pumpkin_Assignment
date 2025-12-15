"use client";

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

interface QRExportProps {
  data: string;
  dataSize: string | null;
  isTooLarge: boolean;
  onClose: () => void;
  onDownload: () => void;
}

/**
 * QR Export component for displaying QR code with export data
 */
export function QRExport({ data, dataSize, isTooLarge, onClose, onDownload }: QRExportProps) {
  const [copied, setCopied] = useState(false);
  const [canShowQR, setCanShowQR] = useState(false);

  // Check if data is small enough for QR code
  useEffect(() => {
    // QR codes can handle up to ~4KB efficiently, but we'll be conservative
    // Maximum for QR code with error correction level M is about 2KB
    const maxQRSize = 2000; // 2KB in characters
    setCanShowQR(data.length <= maxQRSize);
  }, [data]);

  // Copy data to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Export Chat Data</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Warning for large data */}
          {!canShowQR && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">Data Too Large for QR Code</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Your data ({dataSize}) is too large to encode in a QR code. Please use the "Download File" option below to save your backup, then import it on another device using file upload.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isTooLarge && canShowQR && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-yellow-800">Large Data Size</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Your data ({dataSize}) may be difficult to scan. If scanning fails, use the "Download File" option instead.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Data size info */}
          {dataSize && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Export size: {dataSize}</span>
              </div>
            </div>
          )}

          {/* QR Code Display or Alternative */}
          {canShowQR ? (
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg">
                <QRCode
                  value={data}
                  size={256}
                  level="M"
                  className="w-full h-auto"
                />
              </div>
              <p className="text-sm text-gray-600 mt-4 text-center">
                Scan this QR code with another device to transfer your chat data
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-8 flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">QR Code Not Available</h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                Your backup data is too large for a QR code.<br />
                Please download the file and import it on your other device.
              </p>
              <button
                onClick={onDownload}
                className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Backup File
              </button>
            </div>
          )}

          {/* Instructions */}
          {canShowQR ? (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-gray-900 text-sm">How to use:</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Open the app on your new device</li>
                <li>Go to menu → Import Data</li>
                <li>Scan this QR code with your camera</li>
                <li>Your chats and credentials will be transferred automatically</li>
              </ol>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-gray-900 text-sm">How to import on another device:</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Download the backup file using the button above</li>
                <li>Transfer the file to your new device (email, USB, cloud, etc.)</li>
                <li>Open the app on your new device</li>
                <li>Go to menu → Import Data</li>
                <li>Click "Upload Backup File" and select the downloaded file</li>
              </ol>
            </div>
          )}

          {/* Action Buttons */}
          {canShowQR ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={copyToClipboard}
                className="bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Data
                  </>
                )}
              </button>

              <button
                onClick={onDownload}
                className="bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download File
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={copyToClipboard}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy to Clipboard
                  </>
                )}
              </button>
            </div>
          )}

          {/* Security Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Security Notice</h3>
                <p className="text-sm text-red-700 mt-1">
                  This QR code contains your private encryption key and authentication token. Keep it secure and only share with your own devices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}