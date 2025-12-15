import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#1f2937",
    },
    menuButton: {
        padding: 8,
    },
    menuIcon: {
        fontSize: 20,
        color: "#6b7280",
    },
    menuDropdown: {
        position: "absolute",
        top: 50,
        right: 16,
        backgroundColor: "#ffffff",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    menuItem: {
        padding: 12,
    },
    menuItemText: {
        color: "#1f2937",
        fontSize: 14,
    },
    menuItemTextDanger: {
        color: "#dc2626",
        fontSize: 14,
    },
    userInfo: {
        marginBottom: 16,
    },
    username: {
        fontSize: 14,
        fontWeight: "500",
        color: "#1f2937",
    },
    email: {
        fontSize: 12,
        color: "#6b7280",
    },
    viewToggle: {
        flexDirection: "row",
        gap: 8,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
    },
    toggleButtonActive: {
        backgroundColor: "#2563eb",
    },
    toggleButtonText: {
        fontSize: 14,
        fontWeight: "500",
        color: "#6b7280",
    },
    toggleButtonTextActive: {
        color: "#ffffff",
    },
    listArea: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        backgroundColor: "#f3f4f6",
    },
    emptyContainer: {
        padding: 16,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#6b7280",
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 12,
        color: "#9ca3af",
    },
    conversationItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    conversationContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    conversationName: {
        fontSize: 14,
        fontWeight: "500",
        color: "#1f2937",
    },
    conversationDate: {
        fontSize: 12,
        color: "#6b7280",
    },
    conversationEmail: {
        fontSize: 12,
        color: "#6b7280",
        marginTop: 4,
    },
    userItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    userAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#2563eb",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    userAvatarText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
    userInfoContainer: {
        flex: 1,
    },
    userName: {
        fontSize: 14,
        fontWeight: "500",
        color: "#1f2937",
    },
    userEmail: {
        fontSize: 12,
        color: "#6b7280",
    },
});

export default styles;
