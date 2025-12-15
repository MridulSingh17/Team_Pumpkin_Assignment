import { useState, useCallback } from "react";
import {
    exportReadableData,
    getExportFileSize,
    readBackupFile,
    importBackupData,
    validateBackupData,
    type ReadableExportData,
    type ImportSummary,
    type ExportProgress,
} from "@/utils/readableExport";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

interface UseReadableExportState {
    exportData: ReadableExportData | null;
    fileSize: string | null;
    isExporting: boolean;
    isImporting: boolean;
    error: string | null;
    success: boolean;
    importSummary: ImportSummary | null;
    progress: ExportProgress | null;
}

/**
 * Hook for managing readable chat backup export/import
 */
export function useReadableExport(currentUserId?: string) {
    const [state, setState] = useState<UseReadableExportState>({
        exportData: null,
        fileSize: null,
        isExporting: false,
        isImporting: false,
        error: null,
        success: false,
        importSummary: null,
        progress: null,
    });

    /**
     * Generate readable export data
     */
    const generateExport = useCallback(async () => {
        if (!currentUserId) {
            setState((prev) => ({ ...prev, error: "User not authenticated" }));
            return;
        }

        setState((prev) => ({
            ...prev,
            isExporting: true,
            error: null,
            success: false,
            exportData: null,
            fileSize: null,
            progress: {
                currentConversation: 0,
                totalConversations: 0,
                currentMessage: 0,
                totalMessages: 0,
                status: "Starting export...",
            },
        }));

        try {
            const data = await exportReadableData(currentUserId, (progress) => {
                setState((prev) => ({ ...prev, progress }));
            });

            const size = getExportFileSize(data);

            setState((prev) => ({
                ...prev,
                exportData: data,
                fileSize: size,
                isExporting: false,
                success: true,
                error: null,
                progress: null,
            }));
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to generate export";
            setState((prev) => ({
                ...prev,
                isExporting: false,
                error: errorMessage,
                success: false,
                progress: null,
            }));
        }
    }, [currentUserId]);

    /**
     * Download the export file
     */
    const downloadExport = useCallback(async () => {
        if (!state.exportData) {
            setState((prev) => ({
                ...prev,
                error: "No export data available",
            }));
            return;
        }

        try {
            const jsonString = JSON.stringify(state.exportData, null, 2);
            const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, -5);
            const filename = `chat-backup-${timestamp}.json`;
            const fileUri = `${FileSystem.documentDirectory}${filename}`;

            // Write file
            await FileSystem.writeAsStringAsync(fileUri, jsonString, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            // Share file
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: "application/json",
                    dialogTitle: "Save Chat Backup",
                    UTI: "public.json",
                });
            } else {
                throw new Error("Sharing is not available on this device");
            }

            setState((prev) => ({ ...prev, success: true }));
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to download file";
            setState((prev) => ({ ...prev, error: errorMessage }));
        }
    }, [state.exportData]);

    /**
     * Import backup from file
     */
    const importFromFile = useCallback(
        async (fileContent: string) => {
            console.log("📥 importFromFile called");
            console.log(
                `   File content length: ${fileContent.length} characters`
            );

            if (!currentUserId) {
                console.error("❌ User not authenticated");
                setState((prev) => ({
                    ...prev,
                    error: "User not authenticated",
                }));
                return null;
            }

            console.log(`✅ User authenticated: ${currentUserId}`);

            setState((prev) => ({
                ...prev,
                isImporting: true,
                error: null,
                success: false,
                importSummary: null,
                progress: {
                    currentConversation: 0,
                    totalConversations: 0,
                    currentMessage: 0,
                    totalMessages: 0,
                    status: "Reading file...",
                },
            }));

            try {
                console.log("📖 Reading backup file...");
                // Read and parse file
                const data = await readBackupFile(fileContent);
                console.log(`✅ Backup file parsed successfully`);

                // Validate data
                const validation = validateBackupData(data);
                if (!validation.valid) {
                    throw new Error(
                        `Invalid backup file: ${validation.errors.join(", ")}`
                    );
                }

                setState((prev) => ({
                    ...prev,
                    progress: {
                        currentConversation: 0,
                        totalConversations: data.conversations.length,
                        currentMessage: 0,
                        totalMessages: data.metadata.totalMessages,
                        status: "Importing data...",
                    },
                }));

                // Import data
                const summary = await importBackupData(
                    data,
                    currentUserId,
                    (progress) => {
                        setState((prev) => ({ ...prev, progress }));
                    }
                );

                setState((prev) => ({
                    ...prev,
                    isImporting: false,
                    success: summary.success,
                    importSummary: summary,
                    error:
                        summary.errors.length > 0
                            ? summary.errors.join("; ")
                            : null,
                    progress: null,
                }));

                return summary;
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Failed to import backup";
                setState((prev) => ({
                    ...prev,
                    isImporting: false,
                    error: errorMessage,
                    success: false,
                    progress: null,
                }));
                return null;
            }
        },
        [currentUserId]
    );

    /**
     * Clear export data and reset state
     */
    const clearExport = useCallback(() => {
        setState({
            exportData: null,
            fileSize: null,
            isExporting: false,
            isImporting: false,
            error: null,
            success: false,
            importSummary: null,
            progress: null,
        });
    }, []);

    /**
     * Get preview of backup file without importing
     */
    const previewBackupFile = useCallback(async (fileContent: string) => {
        try {
            const data = await readBackupFile(fileContent);
            const validation = validateBackupData(data);

            return {
                valid: validation.valid,
                errors: validation.errors,
                data: {
                    exportedBy: data.exportedBy,
                    exportedAt: data.exportedAt,
                    conversationsCount: data.metadata.totalConversations,
                    messagesCount: data.metadata.totalMessages,
                },
            };
        } catch (error) {
            return {
                valid: false,
                errors: [
                    error instanceof Error
                        ? error.message
                        : "Failed to read file",
                ],
                data: null,
            };
        }
    }, []);

    return {
        // State
        exportData: state.exportData,
        fileSize: state.fileSize,
        isExporting: state.isExporting,
        isImporting: state.isImporting,
        error: state.error,
        success: state.success,
        importSummary: state.importSummary,
        progress: state.progress,

        // Actions
        generateExport,
        downloadExport,
        importFromFile,
        clearExport,
        previewBackupFile,
    };
}
