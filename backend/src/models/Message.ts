import mongoose, { Schema } from 'mongoose';

export interface IEncryptedVersion {
  deviceId: mongoose.Types.ObjectId;
  encryptedContent: string;
}

export interface IMessage extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  senderDeviceId: mongoose.Types.ObjectId;
  senderEncryptedVersions: IEncryptedVersion[];
  recipientEncryptedVersions: IEncryptedVersion[];
  timestamp: Date;
}

const encryptedVersionSchema = new Schema<IEncryptedVersion>({
  deviceId: {
    type: Schema.Types.ObjectId,
    ref: 'Device',
    required: true,
  },
  encryptedContent: {
    type: String,
    required: true,
  },
}, { _id: false });

const messageSchema = new Schema<IMessage>({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  senderDeviceId: {
    type: Schema.Types.ObjectId,
    ref: 'Device',
    required: false
  },
  // Encrypted versions for all sender's devices
  senderEncryptedVersions: {
    type: [encryptedVersionSchema],
    default: []
  },
  // Encrypted versions for all recipient's devices
  recipientEncryptedVersions: {
    type: [encryptedVersionSchema],
    default: []
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ 'senderEncryptedVersions.deviceId': 1 });
messageSchema.index({ 'recipientEncryptedVersions.deviceId': 1 });

export default mongoose.model<IMessage>('Message', messageSchema);