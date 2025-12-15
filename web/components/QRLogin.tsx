"use client";

import { useEffect } from "react";
import { useQRAuth } from "@/hooks/useQRAuth";
import QRCode from "react-qr-code";

interface QRLoginProps {
  onClose: () => void;
}

export function QRLogin({ onClose }: QRLoginProps) {
  const {
    qrToken,
    isGenerating,
    error,
    isExpired,
    isAboutToExpire,
    generateQRToken,
    clearQRToken,
    refreshToken,
    formatTimeRemaining,
  } = useQRAuth();

  // Generate token on mount
  useEffect(() => {
    generateQRToken();

    // Cleanup on unmount
    return () => {
      clearQRToken();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    await refreshToken();
  };

  const handleClose = () => {
    clearQRToken();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Login New Device</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Generating QR code...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isGenerating && (
          <div className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg
                  className="w-5 h-5 text-red-600 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* QR Code Display */}
        {qrToken && !isGenerating && !error && (
          <div className="space-y-6">
            {/* Timer */}
            <div className="text-center">
              <div
                className={`inline-flex items-center px-4 py-2 rounded-lg ${
                  isAboutToExpire
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-semibold text-lg">
                  {formatTimeRemaining()}
                </span>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-6 bg-white border-2 border-gray-200 rounded-lg">
              {isExpired ? (
                <div className="text-center py-8">
                  <svg
                    className="w-16 h-16 text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-gray-600 font-medium">QR Code Expired</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Please generate a new one
                  </p>
                </div>
              ) : (
                <QRCode
                  value={qrToken}
                  size={256}
                  level="M"
                  className="max-w-full h-auto"
                />
              )}
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                How to Login
              </h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">1.</span>
                  <span>Open the app on your mobile device</span>
                </li>
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">2.</span>
                  <span>Tap &ldquo;Scan QR Code&rdquo; or the camera icon</span>
                </li>
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">3.</span>
                  <span>Point your camera at this QR code</span>
                </li>
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">4.</span>
                  <span>Your device will be logged in automatically</span>
                </li>
              </ol>
            </div>

            {/* Warning for expiring soon */}
            {isAboutToExpire && !isExpired && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 flex items-center">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  QR code expires soon. Scan quickly or refresh.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {isExpired ? (
                <button
                  onClick={handleRefresh}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Generate New QR Code
                </button>
              ) : (
                <>
                  <button
                    onClick={handleRefresh}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Refresh
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Done
                  </button>
                </>
              )}
            </div>

            {/* Security Note */}
            <div className="text-center pt-2">
              <p className="text-xs text-gray-500">
                🔒 This QR code is single-use and expires in 5 minutes
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
