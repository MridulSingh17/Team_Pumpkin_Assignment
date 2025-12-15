import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: "#f3f4f6",
    },
    container: {
        flex: 1,
        backgroundColor: "#f3f4f6",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f3f4f6",
    },
    chatHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        backgroundColor: "#ffffff",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    backButtonText: {
        fontSize: 24,
        color: "#2563eb",
    },
    chatHeaderAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#2563eb",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    chatHeaderAvatarText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    chatHeaderInfo: {
        flex: 1,
    },
    chatHeaderName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1f2937",
    },
    chatHeaderEmail: {
        fontSize: 12,
        color: "#6b7280",
    },
    messagesArea: {
        flex: 1,
        backgroundColor: "#f9fafb",
    },
    messagesLoading: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    messagesEmpty: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    messagesEmptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    messagesEmptyText: {
        fontSize: 16,
        color: "#6b7280",
        marginBottom: 4,
    },
    messagesEmptySubtext: {
        fontSize: 14,
        color: "#9ca3af",
    },
    messageContainer: {
        padding: 16,
    },
    messageContainerOwn: {
        alignItems: "flex-end",
    },
    messageContainerOther: {
        alignItems: "flex-start",
    },
    messageBubble: {
        maxWidth: "70%",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    messageBubbleOwn: {
        backgroundColor: "#2563eb",
    },
    messageBubbleOther: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e5e7eb",
    },
    messageText: {
        fontSize: 14,
    },
    messageTextOwn: {
        color: "#ffffff",
    },
    messageTextOther: {
        color: "#1f2937",
    },
    messageTime: {
        fontSize: 12,
        marginTop: 4,
    },
    messageTimeOwn: {
        color: "#dbeafe",
    },
    messageTimeOther: {
        color: "#6b7280",
    },
    messageInputContainer: {
        flexDirection: "row",
        padding: 16,
        backgroundColor: "#ffffff",
        borderTopWidth: 1,
        borderTopColor: "#e5e7eb",
        gap: 8,
    },
    messageInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
        fontSize: 14,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: "#2563eb",
        paddingHorizontal: 24,
        paddingVertical: 8,
        borderRadius: 8,
        justifyContent: "center",
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    sendButtonText: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "500",
    },
});

export default styles;
