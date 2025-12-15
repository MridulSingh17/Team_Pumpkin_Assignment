import React from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import type {
    ReadableExportData,
    ExportProgress,
} from "@/utils/readableExport";

interface BackupExportProps {
    visible: boolean;
    exportData: ReadableExportData | null;
    fileSize: string | null;
    isExporting: boolean;
    progress: ExportProgress | null;
    error: string | null;
    onClose: () => void;
    onDownload: () => void;
}

export function BackupExport({
    visible,
    exportData,
    fileSize,
    isExporting,
    progress,
    error,
    onClose,
    onDownload,
}: BackupExportProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <ThemedView style={styles.container}>
                    <View style={styles.header}>
                        <ThemedText style={styles.title}>
                            Export Chat Backup
                        </ThemedText>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                        >
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {isExporting && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator
                                    size="large"
                                    color="#007AFF"
                                />
                                {progress && (
                                    <View style={styles.progressContainer}>
                                        <ThemedText style={styles.progressText}>
                                            {progress.status}
                                        </ThemedText>
                                        <ThemedText
                                            style={styles.progressDetails}
                                        >
                                            Conversation:{" "}
                                            {progress.currentConversation}/
                                            {progress.totalConversations}
                                        </ThemedText>
                                        {progress.currentMessage > 0 && (
                                            <ThemedText
                                                style={styles.progressDetails}
                                            >
                                                Messages:{" "}
                                                {progress.currentMessage}/
                                                {progress.totalMessages}
                                            </ThemedText>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}

                        {error && (
                            <View style={styles.errorContainer}>
                                <ThemedText style={styles.errorText}>
                                    ❌ {error}
                                </ThemedText>
                            </View>
                        )}

                        {exportData && !isExporting && (
                            <View>
                                <View style={styles.infoContainer}>
                                    <ThemedText style={styles.infoTitle}>
                                        Export Summary
                                    </ThemedText>
                                    <ThemedText style={styles.infoText}>
                                        📊 Conversations:{" "}
                                        {exportData.metadata.totalConversations}
                                    </ThemedText>
                                    <ThemedText style={styles.infoText}>
                                        💬 Messages:{" "}
                                        {exportData.metadata.totalMessages}
                                    </ThemedText>
                                    <ThemedText style={styles.infoText}>
                                        📦 File Size: {fileSize}
                                    </ThemedText>
                                    <ThemedText style={styles.infoText}>
                                        📅 Exported:{" "}
                                        {new Date(
                                            exportData.exportedAt
                                        ).toLocaleString()}
                                    </ThemedText>
                                </View>

                                <View style={styles.warningContainer}>
                                    <ThemedText style={styles.warningTitle}>
                                        ⚠️ Security Warning
                                    </ThemedText>
                                    <ThemedText style={styles.warningText}>
                                        This backup contains your decrypted
                                        messages in plain text. Keep it secure
                                        and only share with your own devices.
                                    </ThemedText>
                                </View>

                                <TouchableOpacity
                                    style={styles.downloadButton}
                                    onPress={onDownload}
                                >
                                    <Text style={styles.downloadButtonText}>
                                        📥 Download Backup File
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    {!isExporting && (
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={onClose}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Close
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ThemedView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        width: "90%",
        maxHeight: "80%",
        borderRadius: 12,
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
    },
    closeButton: {
        padding: 4,
    },
    closeButtonText: {
        fontSize: 24,
        color: "#666",
    },
    content: {
        padding: 16,
    },
    loadingContainer: {
        alignItems: "center",
        padding: 32,
    },
    progressContainer: {
        marginTop: 16,
        alignItems: "center",
    },
    progressText: {
        fontSize: 14,
        marginBottom: 8,
    },
    progressDetails: {
        fontSize: 12,
        color: "#666",
        marginTop: 4,
    },
    errorContainer: {
        backgroundColor: "#ffebee",
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: "#c62828",
        fontSize: 14,
    },
    infoContainer: {
        backgroundColor: "#f5f5f5",
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        marginBottom: 8,
    },
    warningContainer: {
        backgroundColor: "#fff3cd",
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
    },
    warningTitle: {
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 8,
        color: "#856404",
    },
    warningText: {
        fontSize: 12,
        color: "#856404",
    },
    downloadButton: {
        backgroundColor: "#007AFF",
        padding: 16,
        borderRadius: 8,
        alignItems: "center",
        marginBottom: 16,
    },
    downloadButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: "#e0e0e0",
    },
    cancelButton: {
        padding: 12,
        borderRadius: 8,
        alignItems: "center",
        backgroundColor: "#f5f5f5",
    },
    cancelButtonText: {
        fontSize: 16,
        color: "#666",
    },
});
