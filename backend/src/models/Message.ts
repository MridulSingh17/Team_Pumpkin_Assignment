import mongoose, { Schema } from "mongoose";

export interface IEncryptedVersion {
  forDeviceId: mongoose.Types.ObjectId;
  encryptedContent: string;
  iv: string;
}

export interface IMessage extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  senderDeviceId: mongoose.Types.ObjectId;
  encryptedVersions: IEncryptedVersion[];
  timestamp: Date;
}

const encryptedVersionSchema = new Schema<IEncryptedVersion>(
  {
    forDeviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    encryptedContent: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    senderDeviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: false,
    },
    // Encrypted versions for all devices (sender + recipient)
    encryptedVersions: {
      type: [encryptedVersionSchema],
      required: true,
      validate: {
        validator: function (v: IEncryptedVersion[]) {
          return v.length > 0;
        },
        message: "At least one encrypted version is required",
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for efficient querying
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ "encryptedVersions.forDeviceId": 1 });

export default mongoose.model<IMessage>("Message", messageSchema);
