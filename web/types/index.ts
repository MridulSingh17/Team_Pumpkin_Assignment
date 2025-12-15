// User Types
export interface User {
  _id: string;
  email: string;
  username: string;
  publicKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  publicKey: string;
  deviceType: string;
}

export interface LoginData {
  email: string;
  password: string;
  deviceType?: string;
  publicKey?: string;
}

export interface Device {
  _id: string;
  deviceId: string;
  deviceType: 'web' | 'ios' | 'android';
  publicKey: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterDeviceData {
  deviceType: 'web' | 'ios' | 'android';
  publicKey: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    device?: Device | null;
    token: string;
  };
}

// Conversation Types
export interface Participant {
  _id: string;
  username: string;
  email: string;
  publicKey: string;
}

export interface Conversation {
  _id: string;
  participants: Participant[];
  createdAt: string;
  lastMessageAt: string;
  lastMessage?: Message;
}

export interface CreateConversationData {
  participantId: string;
}

// Message Types
export interface DeviceEncryptedVersion {
  deviceId: string;
  encryptedContent: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: {
    _id: string;
    username: string;
    email: string;
  };
  recipientId: string;
  senderDeviceId: string;
  senderEncryptedVersions: DeviceEncryptedVersion[];
  recipientEncryptedVersions: DeviceEncryptedVersion[];
  timestamp: string;
}

export interface SendMessageData {
  conversationId: string;
  senderDeviceId: string;
  senderEncryptedVersions: DeviceEncryptedVersion[];
  recipientEncryptedVersions: DeviceEncryptedVersion[];
}

export interface MessagesPagination {
  currentPage: number;
  totalPages: number;
  totalMessages: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface MessagesResponse {
  success: boolean;
  data: {
    messages: Message[];
    pagination: MessagesPagination;
  };
}

// Export/Import Types
export interface ExportData {
  conversationId: string;
  backupKey: string;
}

export interface ImportData {
  encryptedData: string;
  backupKey: string;
}

export interface ExportResponse {
  success: boolean;
  message: string;
  data: {
    encryptedData: string;
    conversationId: string;
    messageCount: number;
    exportedAt: string;
  };
}

export interface ImportResponse {
  success: boolean;
  message: string;
  data: {
    conversationId: string;
    totalMessages: number;
    importedCount: number;
    skippedCount: number;
    importedAt: string;
  };
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Socket Event Types
export interface SocketMessage {
  message: Message;
}

export interface SendSocketMessage {
  conversationId: string;
  senderDeviceId: string;
  senderEncryptedVersions: DeviceEncryptedVersion[];
  recipientEncryptedVersions: DeviceEncryptedVersion[];
}

// Encryption Types
export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedMessage {
  encryptedContent: string;
  iv?: string;
}