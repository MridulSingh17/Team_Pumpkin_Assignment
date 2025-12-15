"use client";

import { useState, useCallback } from 'react';
import { exportAllData, importAllData, parseImportString, getDataSize, formatDataSize, isDataTooLarge } from '@/lib/dataExport';
import type { ExportData } from '@/lib/dataExport';

interface QRExportState {
  isExporting: boolean;
  isImporting: boolean;
  exportData: string | null;
  exportSize: string | null;
  error: string | null;
  success: boolean;
  isTooLarge: boolean;
}

/**
 * Hook for managing QR code export/import functionality
 */
export function useQRExport() {
  const [state, setState] = useState<QRExportState>({
    isExporting: false,
    isImporting: false,
    exportData: null,
    exportSize: null,
    error: null,
    success: false,
    isTooLarge: false,
  });

  /**
   * Generate QR code data by exporting all chats and credentials
   */
  const generateQRData = useCallback(async () => {
    setState(prev => ({ ...prev, isExporting: true, error: null, success: false }));

    try {
      // Export all data
      const data = await exportAllData();

      // Check if data is too large
      const tooLarge = isDataTooLarge(data);
      const size = getDataSize(data);

      // Convert to JSON string
      const dataString = JSON.stringify(data);

      setState({
        isExporting: false,
        isImporting: false,
        exportData: dataString,
        exportSize: formatDataSize(size),
        error: null,
        success: true,
        isTooLarge: tooLarge,
      });

      return dataString;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate QR data';
      setState(prev => ({
        ...prev,
        isExporting: false,
        error: errorMessage,
        success: false,
      }));
      throw error;
    }
  }, []);

  /**
   * Import data from QR code scan
   */
  const importQRData = useCallback(async (dataString: string) => {
    setState(prev => ({ ...prev, isImporting: true, error: null, success: false }));

    try {
      // Parse the data string
      const data = parseImportString(dataString);

      // Import the data
      await importAllData(data);

      setState({
        isExporting: false,
        isImporting: false,
        exportData: null,
        exportSize: null,
        error: null,
        success: true,
        isTooLarge: false,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import QR data';
      setState(prev => ({
        ...prev,
        isImporting: false,
        error: errorMessage,
        success: false,
      }));
      throw error;
    }
  }, []);

  /**
   * Clear export data and reset state
   */
  const clearExportData = useCallback(() => {
    setState({
      isExporting: false,
      isImporting: false,
      exportData: null,
      exportSize: null,
      error: null,
      success: false,
      isTooLarge: false,
    });
  }, []);

  /**
   * Download export data as JSON file (fallback for large data)
   */
  const downloadAsFile = useCallback(() => {
    if (!state.exportData) return;

    try {
      const blob = new Blob([state.exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to download backup file',
      }));
    }
  }, [state.exportData]);

  /**
   * Import from uploaded file
   */
  const importFromFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isImporting: true, error: null, success: false }));

    try {
      const text = await file.text();
      await importQRData(text);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import from file';
      setState(prev => ({
        ...prev,
        isImporting: false,
        error: errorMessage,
        success: false,
      }));
      throw error;
    }
  }, [importQRData]);

  return {
    ...state,
    generateQRData,
    importQRData,
    clearExportData,
    downloadAsFile,
    importFromFile,
  };
}