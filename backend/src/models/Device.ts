import mongoose, { Schema } from 'mongoose';

export interface IDevice extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: string;
  deviceType: 'web' | 'ios' | 'android';
  publicKey: string;
  isActive: boolean;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
  lastActiveAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<IDevice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceType: {
      type: String,
      enum: ['web', 'ios', 'android'],
      required: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      default: null,
      select: false, // Don't return in queries by default
    },
    refreshTokenExpiresAt: {
      type: Date,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
deviceSchema.index({ userId: 1, isActive: 1 });

// Ensure user doesn't exceed 5 devices
deviceSchema.pre('save', async function () {
  if (this.isNew) {
    const count = await mongoose.model('Device').countDocuments({
      userId: this.userId,
      isActive: true,
    });

    if (count >= 5) {
      throw new Error('Maximum 5 devices allowed per user');
    }
  }
});

export default mongoose.model<IDevice>('Device', deviceSchema);