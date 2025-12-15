"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

interface QRAuthState {
  qrToken: string | null;
  expiresAt: Date | null;
  isGenerating: boolean;
  error: string | null;
  timeRemaining: number; // seconds
}

interface QRTokenResponse {
  success: boolean;
  data?: {
    token: string;
    expiresAt: string;
  };
  message?: string;
}

/**
 * Hook for managing QR-based device authentication
 * Generates temporary tokens for mobile device login via QR code
 */
export function useQRAuth() {
  const [state, setState] = useState<QRAuthState>({
    qrToken: null,
    expiresAt: null,
    isGenerating: false,
    error: null,
    timeRemaining: 0,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calculate time remaining until token expires
   */
  const calculateTimeRemaining = useCallback((expiresAt: Date | null): number => {
    if (!expiresAt) return 0;
    const now = new Date();
    const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    return Math.max(0, remaining);
  }, []);

  /**
   * Update countdown timer
   */
  useEffect(() => {
    if (state.expiresAt) {
      // Update immediately
      const remaining = calculateTimeRemaining(state.expiresAt);
      setState(prev => ({ ...prev, timeRemaining: remaining }));

      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set up interval to update every second
      intervalRef.current = setInterval(() => {
        const remaining = calculateTimeRemaining(state.expiresAt);
        setState(prev => ({ ...prev, timeRemaining: remaining }));

        // Clear token when expired
        if (remaining <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setState(prev => ({
            ...prev,
            qrToken: null,
            expiresAt: null,
            timeRemaining: 0,
          }));
        }
      }, 1000);
    }

    // Cleanup on unmount or when expiresAt changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.expiresAt, calculateTimeRemaining]);

  /**
   * Generate a new QR token from the backend
   */
  const generateQRToken = useCallback(async (): Promise<string | null> => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/qr-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      const data: QRTokenResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate QR token');
      }

      if (!data.data) {
        throw new Error('Invalid response from server');
      }

      const expiresAt = new Date(data.data.expiresAt);
      const timeRemaining = calculateTimeRemaining(expiresAt);

      setState({
        qrToken: data.data.token,
        expiresAt,
        isGenerating: false,
        error: null,
        timeRemaining,
      });

      return data.data.token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate QR token';
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: errorMessage,
        qrToken: null,
        expiresAt: null,
        timeRemaining: 0,
      }));
      return null;
    }
  }, [calculateTimeRemaining]);

  /**
   * Clear the current QR token and reset state
   */
  const clearQRToken = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState({
      qrToken: null,
      expiresAt: null,
      isGenerating: false,
      error: null,
      timeRemaining: 0,
    });
  }, []);

  /**
   * Refresh token (regenerate if expired or about to expire)
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    return await generateQRToken();
  }, [generateQRToken]);

  /**
   * Format time remaining as MM:SS
   */
  const formatTimeRemaining = useCallback((): string => {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [state.timeRemaining]);

  /**
   * Check if token is expired
   */
  const isExpired = state.timeRemaining <= 0 && state.qrToken !== null;

  /**
   * Check if token is about to expire (less than 30 seconds)
   */
  const isAboutToExpire = state.timeRemaining > 0 && state.timeRemaining < 30;

  return {
    qrToken: state.qrToken,
    expiresAt: state.expiresAt,
    isGenerating: state.isGenerating,
    error: state.error,
    timeRemaining: state.timeRemaining,
    isExpired,
    isAboutToExpire,
    generateQRToken,
    clearQRToken,
    refreshToken,
    formatTimeRemaining,
  };
}