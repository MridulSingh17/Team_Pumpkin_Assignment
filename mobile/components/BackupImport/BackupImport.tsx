import React, { useState } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import type { ImportSummary, ExportProgress } from "@/utils/readableExport";

interface BackupImportProps {
    visible: boolean;
    isImporting: boolean;
    progress: ExportProgress | null;
    importSummary: ImportSummary | null;
    error: string | null;
    onClose: () => void;
    onImport: (fileContent: string) => Promise<ImportSummary | null>;
}

export function BackupImport({
    visible,
    isImporting,
    progress,
    importSummary,
    error,
    onClose,
    onImport,
}: BackupImportProps) {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    const handleSelectFile = async () => {
        try {
            console.log("📂 Opening file picker...");
            const result = await DocumentPicker.getDocumentAsync({
                type: "application/json",
                copyToCacheDirectory: true,
            });

            console.log("📂 File picker returned");
            console.log("Result:", JSON.stringify(result, null, 2));

            if (result.canceled) {
                console.log("❌ File picker canceled");
                return;
            }

            if (!result.assets || result.assets.length === 0) {
                console.error("❌ No file selected");
                Alert.alert("Error", "No file selected");
                return;
            }

            const file = result.assets[0];
            console.log(`✅ File selected: ${file.name}`);
            console.log(`   URI: ${file.uri}`);
            console.log(`   Size: ${file.size} bytes`);
            console.log(`   Type: ${file.mimeType}`);
            setSelectedFile(file.name);

            // Read file content
            console.log("📖 Reading file content...");
            const content = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.UTF8,
            });
            console.log(
                `✅ File read successfully (${content.length} characters)`
            );

            // Import the backup
            console.log("🚀 Calling onImport...");
            const summary = await onImport(content);
            console.log("✅ onImport completed:", summary);

            if (summary?.success) {
                Alert.alert(
                    "Import Successful",
                    `Imported ${summary.conversationsImported} conversations and ${summary.messagesImported} messages.`,
                    [{ text: "OK", onPress: onClose }]
                );
            } else {
                console.log("⚠️ Import completed but not successful:", summary);
            }
        } catch (err) {
            console.error("❌ Error in handleSelectFile:", err);
            console.error("Error details:", JSON.stringify(err, null, 2));
            Alert.alert(
                "Error",
                "Failed to read backup file: " +
                    (err instanceof Error ? err.message : String(err))
            );
        }
    };

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
                            Import Chat Backup
                        </ThemedText>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                        >
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {!isImporting && !importSummary && (
                            <View>
                                <View style={styles.infoContainer}>
                                    <ThemedText style={styles.infoTitle}>
                                        📥 Import Backup
                                    </ThemedText>
                                    <ThemedText style={styles.infoText}>
                                        Select a backup file to import your chat
                                        history. Imported messages will be
                                        merged with your existing conversations.
                                    </ThemedText>
                                </View>

                                <View style={styles.warningContainer}>
                                    <ThemedText style={styles.warningTitle}>
                                        ⚠️ Important
                                    </ThemedText>
                                    <ThemedText style={styles.warningText}>
                                        • Only import backups from your own
                                        devices{"\n"}• Imported messages cannot
                                        be edited or deleted{"\n"}• Duplicate
                                        messages will be skipped
                                    </ThemedText>
                                </View>

                                <TouchableOpacity
                                    style={styles.selectButton}
                                    onPress={handleSelectFile}
                                >
                                    <Text style={styles.selectButtonText}>
                                        📁 Select Backup File
                                    </Text>
                                </TouchableOpacity>

                                {selectedFile && (
                                    <ThemedText style={styles.selectedFileText}>
                                        Selected: {selectedFile}
                                    </ThemedText>
                                )}
                            </View>
                        )}

                        {isImporting && (
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

                        {importSummary && !isImporting && (
                            <View style={styles.summaryContainer}>
                                <ThemedText style={styles.summaryTitle}>
                                    {importSummary.success
                                        ? "✅ Import Complete"
                                        : "⚠️ Import Completed with Errors"}
                                </ThemedText>
                                <ThemedText style={styles.summaryText}>
                                    📊 Conversations:{" "}
                                    {importSummary.conversationsImported}
                                </ThemedText>
                                <ThemedText style={styles.summaryText}>
                                    💬 Messages:{" "}
                                    {importSummary.messagesImported}
                                </ThemedText>
                                {importSummary.errors.length > 0 && (
                                    <View style={styles.errorsContainer}>
                                        <ThemedText style={styles.errorsTitle}>
                                            Errors:
                                        </ThemedText>
                                        {importSummary.errors.map(
                                            (err, idx) => (
                                                <ThemedText
                                                    key={idx}
                                                    style={styles.errorItem}
                                                >
                                                    • {err}
                                                </ThemedText>
                                            )
                                        )}
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {!isImporting && (
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
    infoContainer: {
        backgroundColor: "#f5f5f5",
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        lineHeight: 20,
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
        lineHeight: 18,
    },
    selectButton: {
        backgroundColor: "#007AFF",
        padding: 16,
        borderRadius: 8,
        alignItems: "center",
        marginBottom: 16,
    },
    selectButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    selectedFileText: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
        marginTop: -8,
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
    summaryContainer: {
        backgroundColor: "#e8f5e9",
        padding: 16,
        borderRadius: 8,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 12,
    },
    summaryText: {
        fontSize: 14,
        marginBottom: 8,
    },
    errorsContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: "#ffebee",
        borderRadius: 8,
    },
    errorsTitle: {
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 8,
        color: "#c62828",
    },
    errorItem: {
        fontSize: 12,
        color: "#c62828",
        marginBottom: 4,
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
