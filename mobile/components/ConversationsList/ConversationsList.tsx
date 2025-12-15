import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useUsers } from "@/hooks/useUsers";
import { useReadableExport } from "@/hooks/useReadableExport";
import { BackupExport } from "@/components/BackupExport";
import { BackupImport } from "@/components/BackupImport";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import styles from "./ConversationsList.style";

enum ViewMode {
    Conversations = "conversations",
    Users = "users",
}

const ConversationsList = () => {
    const router = useRouter();
    const { user, logout, loading: authLoading } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Conversations);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    const {
        conversations,
        loading: conversationsLoading,
        getOrCreateConversation,
        fetchConversations,
    } = useConversations();

    const { users, loading: usersLoading } = useUsers();

    const {
        exportData,
        fileSize,
        isExporting,
        isImporting,
        error: backupError,
        importSummary,
        progress,
        generateExport,
        downloadExport,
        importFromFile,
        clearExport,
    } = useReadableExport(user?._id);

    const handleUserClick = async (userId: string) => {
        try {
            const conversation = await getOrCreateConversation({
                participantId: userId,
            });
            if (conversation) {
                router.push(`/chat/${conversation._id}`);
            }
        } catch (err) {
            console.error("Failed to start conversation", err);
        }
    };

    const handleConversationClick = (conversationId: string) => {
        router.push(`/chat/${conversationId}`);
    };

    const handleExportBackup = async () => {
        setShowMenu(false);
        setShowExportModal(true);
        await generateExport();
    };

    const handleImportBackup = () => {
        setShowMenu(false);
        setShowImportModal(true);
    };

    const handleCloseExportModal = () => {
        setShowExportModal(false);
        clearExport();
    };

    const handleCloseImportModal = async () => {
        // Refresh conversations if import was successful
        if (importSummary?.success) {
            await fetchConversations();
        }
        setShowImportModal(false);
        clearExport();
    };

    if (authLoading || !user) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={{ marginTop: 10, color: "#666" }}>
                    Loading user data...
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.title}>Encrypted Chat</Text>
                    <TouchableOpacity
                        onPress={() => setShowMenu(!showMenu)}
                        style={styles.menuButton}
                    >
                        <Text style={styles.menuIcon}>⋮</Text>
                    </TouchableOpacity>
                </View>

                {showMenu && (
                    <View style={styles.menuDropdown}>
                        <TouchableOpacity
                            onPress={handleExportBackup}
                            style={styles.menuItem}
                        >
                            <Text style={styles.menuItemText}>
                                📥 Export Backup
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleImportBackup}
                            style={styles.menuItem}
                        >
                            <Text style={styles.menuItemText}>
                                📤 Import Backup
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={logout}
                            style={styles.menuItem}
                        >
                            <Text style={styles.menuItemTextDanger}>
                                Logout
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.userInfo}>
                    <Text style={styles.username}>{user?.username}</Text>
                    <Text style={styles.email}>{user?.email}</Text>
                </View>

                {/* View Toggle */}
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        onPress={() => setViewMode(ViewMode.Conversations)}
                        style={[
                            styles.toggleButton,
                            viewMode === ViewMode.Conversations &&
                                styles.toggleButtonActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.toggleButtonText,
                                viewMode === ViewMode.Conversations &&
                                    styles.toggleButtonTextActive,
                            ]}
                        >
                            Chats
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setViewMode(ViewMode.Users)}
                        style={[
                            styles.toggleButton,
                            viewMode === ViewMode.Users &&
                                styles.toggleButtonActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.toggleButtonText,
                                viewMode === ViewMode.Users &&
                                    styles.toggleButtonTextActive,
                            ]}
                        >
                            All Users
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List Area */}
            <View style={styles.listArea}>
                {viewMode === ViewMode.Conversations ? (
                    // Conversations List
                    conversationsLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#2563eb" />
                        </View>
                    ) : conversations.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                No conversations yet.
                            </Text>
                            <Text style={styles.emptySubtext}>
                                Go to &quot;All Users&quot; to start chatting!
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={conversations}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => {
                                const participant = item.participants.find(
                                    (p) => p._id !== user?._id
                                );

                                return (
                                    <TouchableOpacity
                                        onPress={() =>
                                            handleConversationClick(item._id)
                                        }
                                        style={styles.conversationItem}
                                    >
                                        <View
                                            style={styles.conversationContent}
                                        >
                                            <Text
                                                style={styles.conversationName}
                                            >
                                                {participant?.username ||
                                                    "Unknown"}
                                            </Text>
                                            <Text
                                                style={styles.conversationDate}
                                            >
                                                {format(
                                                    new Date(
                                                        item.lastMessageAt
                                                    ),
                                                    "MMM d"
                                                )}
                                            </Text>
                                        </View>
                                        <Text style={styles.conversationEmail}>
                                            {participant?.email || ""}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )
                ) : // Users List
                usersLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#2563eb" />
                    </View>
                ) : users.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            No other users found.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={users}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handleUserClick(item._id)}
                                style={styles.userItem}
                            >
                                <View style={styles.userAvatar}>
                                    <Text style={styles.userAvatarText}>
                                        {item.username.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.userInfoContainer}>
                                    <Text style={styles.userName}>
                                        {item.username}
                                    </Text>
                                    <Text style={styles.userEmail}>
                                        {item.email}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>

            {/* Backup Export Modal */}
            <BackupExport
                visible={showExportModal}
                exportData={exportData}
                fileSize={fileSize}
                isExporting={isExporting}
                progress={progress}
                error={backupError}
                onClose={handleCloseExportModal}
                onDownload={downloadExport}
            />

            {/* Backup Import Modal */}
            <BackupImport
                visible={showImportModal}
                isImporting={isImporting}
                progress={progress}
                importSummary={importSummary}
                error={backupError}
                onClose={handleCloseImportModal}
                onImport={importFromFile}
            />
        </View>
    );
};

export default React.memo(ConversationsList);
