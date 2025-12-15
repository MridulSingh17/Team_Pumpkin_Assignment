import { Document, Types } from 'mongoose';

// User interfaces
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  username: string;
  passwordHash: string;
  publicKey: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  toJSON(): any;
}

// Message interfaces
export interface IEncryptedVersion {
  deviceId: Types.ObjectId;
  encryptedContent: string;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  senderDeviceId: Types.ObjectId;
  senderEncryptedVersions: IEncryptedVersion[];
  recipientEncryptedVersions: IEncryptedVersion[];
  timestamp: Date;
}

// Conversation interfaces
export interface IConversation extends Document {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  createdAt: Date;
  lastMessageAt: Date;
}

// Socket interfaces
export interface ISocketUser {
  userId: string;
  socketId: string;
}

export interface ISendMessageData {
  conversationId: string;
  senderDeviceId: string;
  senderEncryptedVersions: Array<{
    deviceId: string;
    encryptedContent: string;
  }>;
  recipientEncryptedVersions: Array<{
    deviceId: string;
    encryptedContent: string;
  }>;
}

export interface ISocketCallback {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// JWT Payload
export interface IJWTPayload {
  userId: string;
}

// API Response interfaces
export interface IApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  stack?: string;
}

export interface IPaginationInfo {
  currentPage: number;
  totalPages: number;
  totalMessages: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}