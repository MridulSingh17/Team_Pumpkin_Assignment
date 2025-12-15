import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import styles from "./ChatDetail.style";

const ChatDetail = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [messageInput, setMessageInput] = useState("");

    const { conversations, updateLastMessage } = useConversations();

    // Get selected conversation
    const selectedConversation = conversations.find((c) => c._id === id);

    // Get other participant in the conversation
    const otherParticipant = selectedConversation?.participants.find(
        (p) => p._id !== user?._id
    );

    const {
        messages,
        loading: messagesLoading,
        sendMessage,
        getDecryptedContent,
    } = useMessages({
        conversationId: id || null,
        recipientId: otherParticipant?._id || "",
        currentUserId: user?._id,
    });

    // Handle send message
    const handleSendMessage = async () => {
        if (!messageInput.trim() || !id || !otherParticipant) return;

        const success = await sendMessage(messageInput);
        if (success) {
            setMessageInput("");
            updateLastMessage(id, new Date().toISOString());
        }
    };

    // Show loading while auth is loading or user is not available
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

    if (!selectedConversation || !otherParticipant) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.select({ ios: 50, android: 50 })}
            style={styles.mainContainer}
        >
            <View style={styles.container}>
                {/* Chat Header */}
                <View style={styles.chatHeader}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.chatHeaderAvatar}>
                        <Text style={styles.chatHeaderAvatarText}>
                            {otherParticipant.username.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.chatHeaderInfo}>
                        <Text style={styles.chatHeaderName}>
                            {otherParticipant.username}
                        </Text>
                        <Text style={styles.chatHeaderEmail}>
                            {otherParticipant.email}
                        </Text>
                    </View>
                </View>

                {/* Messages Area */}
                <View style={styles.messagesArea}>
                    {messagesLoading ? (
                        <View style={styles.messagesLoading}>
                            <ActivityIndicator size="large" color="#2563eb" />
                        </View>
                    ) : messages.length === 0 ? (
                        <View style={styles.messagesEmpty}>
                            <Text style={styles.messagesEmptyIcon}>💬</Text>
                            <Text style={styles.messagesEmptyText}>
                                No messages yet.
                            </Text>
                            <Text style={styles.messagesEmptySubtext}>
                                Send a message to start the conversation!
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={messages}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => {
                                const isOwn = item.senderId._id === user?._id;
                                const decryptedContent = getDecryptedContent(
                                    item._id
                                );

                                return (
                                    <View
                                        style={[
                                            styles.messageContainer,
                                            isOwn
                                                ? styles.messageContainerOwn
                                                : styles.messageContainerOther,
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.messageBubble,
                                                isOwn
                                                    ? styles.messageBubbleOwn
                                                    : styles.messageBubbleOther,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.messageText,
                                                    isOwn
                                                        ? styles.messageTextOwn
                                                        : styles.messageTextOther,
                                                ]}
                                            >
                                                {decryptedContent}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.messageTime,
                                                    isOwn
                                                        ? styles.messageTimeOwn
                                                        : styles.messageTimeOther,
                                                ]}
                                            >
                                                {format(
                                                    new Date(item.timestamp),
                                                    "HH:mm"
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            }}
                        />
                    )}
                </View>

                {/* Message Input */}
                <View style={styles.messageInputContainer}>
                    <TextInput
                        style={styles.messageInput}
                        value={messageInput}
                        onChangeText={setMessageInput}
                        placeholder="Type a message..."
                        editable={!messagesLoading}
                        multiline
                    />
                    <TouchableOpacity
                        onPress={handleSendMessage}
                        disabled={!messageInput.trim() || messagesLoading}
                        style={[
                            styles.sendButton,
                            (!messageInput.trim() || messagesLoading) &&
                                styles.sendButtonDisabled,
                        ]}
                    >
                        <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default React.memo(ChatDetail);
