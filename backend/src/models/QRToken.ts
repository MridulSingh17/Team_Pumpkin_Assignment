import mongoose, { Schema } from "mongoose";

export interface IQRToken extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  isUsed: boolean;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const qrTokenSchema = new Schema<IQRToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true, // For TTL and cleanup
    },
    isUsed: {
      type: Boolean,
      default: false,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient token validation queries
qrTokenSchema.index({ token: 1, isUsed: 1 });

// TTL index to automatically delete expired tokens after they expire
// MongoDB will delete documents where expiresAt is older than current time
qrTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Clean up old unused tokens for a user (optional pre-save hook)
qrTokenSchema.pre("save", async function () {
  if (this.isNew) {
    // When creating a new token, optionally clean up old expired tokens for this user
    try {
      await mongoose.model("QRToken").deleteMany({
        userId: this.userId,
        expiresAt: { $lt: new Date() },
      });
    } catch (error) {
      console.error("Error cleaning up old QR tokens:", error);
    }
  }
});

export default mongoose.model<IQRToken>("QRToken", qrTokenSchema);
