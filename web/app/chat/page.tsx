"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useUsers } from "@/hooks/useUsers";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useQRExport } from "@/hooks/useQRExport";
import { useReadableExport } from "@/hooks/useReadableExport";
import { QRExport } from "@/components/QRExport";
import { QRScanner } from "@/components/QRScanner";
import { BackupExport } from "@/components/BackupExport";
import { BackupImport } from "@/components/BackupImport";
import QRLoginModal from "@/components/modals/QRLoginModal";
import { format } from "date-fns";

export default function ChatPage() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messageInput, setMessageInput] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showQRLoginModal, setShowQRLoginModal] = useState(false);
  const [showBackupExportModal, setShowBackupExportModal] = useState(false);
  const [showBackupImportModal, setShowBackupImportModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewMode, setViewMode] = useState<"conversations" | "users">(
    "conversations",
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    loading: conversationsLoading,
    getOrCreateConversation,
    updateLastMessage,
  } = useConversations();
  const { users, loading: usersLoading } = useUsers();

  // Get selected conversation
  const selectedConversation = conversations.find(
    (c) => c._id === selectedConversationId,
  );

  // Get other participant in the conversation
  const otherParticipant = selectedConversation?.participants.find(
    (p) => p._id !== user?._id,
  );

  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    getDecryptedContent,
  } = useMessages({
    conversationId: selectedConversationId,
    recipientId: otherParticipant?._id || "",
    currentUserId: user?._id,
  });

  // Initialize local storage and cleanup
  useLocalStorage();

  // QR Export/Import functionality
  const {
    exportData,
    exportSize,
    isTooLarge,
    isExporting,
    isImporting,

    generateQRData,
    importQRData,
    clearExportData,
    downloadAsFile,
  } = useQRExport();

  // Readable backup export/import
  const {
    exportData: backupExportData,
    fileSize: backupFileSize,
    isExporting: isBackupExporting,
    isImporting: isBackupImporting,
    error: backupError,
    success: backupSuccess,
    importSummary: backupImportSummary,
    progress: backupProgress,
    generateExport: generateBackupExport,
    downloadExport: downloadBackupExport,
    importFromFile: importBackupFromFile,
    clearExport: clearBackupExport,
    previewBackupFile,
  } = useReadableExport(user?._id);

  // Redirect if not authenticated (wait for loading to complete)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversationId || !otherParticipant)
      return;

    const success = await sendMessage(messageInput);
    if (success) {
      setMessageInput("");
      updateLastMessage(selectedConversationId, new Date().toISOString());
    }
  };

  // Handle user click - create or get conversation
  const handleUserClick = async (userId: string) => {
    try {
      const conversation = await getOrCreateConversation({
        participantId: userId,
      });
      if (conversation) {
        setSelectedConversationId(conversation._id);
        setViewMode("conversations");
      }
    } catch {
      alert("Failed to start conversation");
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      await generateQRData();
      setShowExportModal(true);
      setShowMenu(false);
    } catch {
      alert("Failed to generate export data");
    }
  };

  // Handle backup export
  const handleBackupExport = () => {
    setShowBackupExportModal(true);
    setShowMenu(false);
  };

  // Handle backup import
  const handleBackupImport = () => {
    setShowBackupImportModal(true);
    setShowMenu(false);
  };

  // Handle backup import complete
  const handleBackupImportComplete = async () => {
    // Refresh conversations and messages
    setShowBackupImportModal(false);
    window.location.reload(); // Simple refresh to show imported data
  };

  // Handle import
  const handleImport = async (data: string) => {
    try {
      await importQRData(data);
      setShowImportModal(false);
      alert("Data imported successfully! Please refresh the page.");
      // Refresh the page to load new data
      window.location.reload();
    } catch (error) {
      alert(
        "Failed to import data: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Users/Conversations List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">Encrypted Chat</h1>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                  title="Menu"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>

                {showMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={handleBackupExport}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Export Readable Backup
                    </button>
                    <button
                      onClick={handleBackupImport}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                        />
                      </svg>
                      Import Readable Backup
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={() => {
                        setShowQRLoginModal(true);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                      Login via QR Code
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600 mb-4">
            <p className="font-medium">{user?.username}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("conversations")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                viewMode === "conversations"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setViewMode("users")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                viewMode === "users"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Users
            </button>
          </div>
        </div>

        {/* List Area */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "conversations" ? (
            // Conversations List
            conversationsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                <p className="mb-2">No conversations yet.</p>
                <p className="text-xs">
                  Go to &quot;All Users&quot; to start chatting!
                </p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const participant = conversation.participants.find(
                  (p) => p._id !== user?._id,
                );
                const isSelected = conversation._id === selectedConversationId;

                return (
                  <div
                    key={conversation._id}
                    onClick={() => setSelectedConversationId(conversation._id)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-800">
                        {participant?.username || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(conversation.lastMessageAt), "MMM d")}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {participant?.email || ""}
                    </p>
                  </div>
                );
              })
            )
          ) : // Users List
          usersLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No other users found.
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u._id}
                onClick={() => handleUserClick(u._id)}
                className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{u.username}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {u.email}
                      </p>
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId && otherParticipant ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                  {otherParticipant.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {otherParticipant.username}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {otherParticipant.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <p>No messages yet.</p>
                    <p className="text-sm mt-1">
                      Send a message to start the conversation!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwn = message.senderId._id === user?._id;
                  const decryptedContent = getDecryptedContent(message._id);

                  return (
                    <div
                      key={message._id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          isOwn
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-800 border border-gray-200"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap wrap-break-word">
                          {decryptedContent}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            isOwn ? "text-blue-100" : "text-gray-500"
                          }`}
                        >
                          {format(new Date(message.timestamp), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={messagesLoading}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || messagesLoading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="mt-4 text-lg">
                Select a conversation or user to start chatting
              </p>
              <p className="text-sm mt-2">
                Choose from your chats or browse all users
              </p>
            </div>
          </div>
        )}
      </div>

      {/* QR Export Modal */}
      {showExportModal && exportData && (
        <QRExport
          data={exportData}
          dataSize={exportSize}
          isTooLarge={isTooLarge}
          onClose={() => {
            setShowExportModal(false);
            clearExportData();
          }}
          onDownload={downloadAsFile}
        />
      )}

      {/* QR Import Modal */}
      {showImportModal && (
        <QRScanner
          onScan={handleImport}
          onClose={() => setShowImportModal(false)}
          title="Import Chat Data"
          description="Scan the QR code or upload an export file"
        />
      )}

      {/* QR Login Modal */}
      {showQRLoginModal && (
        <QRLoginModal
          isOpen={showQRLoginModal}
          onClose={() => setShowQRLoginModal(false)}
        />
      )}

      {/* Backup Export Modal */}
      {showBackupExportModal && (
        <BackupExport
          exportData={backupExportData}
          fileSize={backupFileSize}
          isExporting={isBackupExporting}
          error={backupError}
          progress={backupProgress}
          onExport={generateBackupExport}
          onDownload={downloadBackupExport}
          onClose={() => {
            setShowBackupExportModal(false);
            clearBackupExport();
          }}
        />
      )}

      {/* Backup Import Modal */}
      {showBackupImportModal && (
        <BackupImport
          isImporting={isBackupImporting}
          error={backupError}
          importSummary={backupImportSummary}
          progress={backupProgress}
          onImport={async (file) => {
            const summary = await importBackupFromFile(file);
            if (summary?.success) {
              setTimeout(handleBackupImportComplete, 1000);
            }
            return summary;
          }}
          onClose={() => {
            setShowBackupImportModal(false);
            clearBackupExport();
          }}
          onPreview={previewBackupFile}
        />
      )}
    </div>
  );
}
