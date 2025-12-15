import mongoose, { Schema } from "mongoose";
import { IConversation } from "../types/interfaces";

const conversationSchema = new Schema<IConversation>({
  participants: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
});

// Validate that there are exactly 2 participants
conversationSchema.pre("save", function () {
  if (this.participants.length !== 2) {
    throw new Error("Conversation must have exactly 2 participants");
  }
});

// // Compound index for finding conversations by participants
// conversationSchema.index({ participants: 1 });
// conversationSchema.index({ lastMessageAt: -1 });

// // Create a unique compound index to prevent duplicate conversations
// conversationSchema.index({ participants: 1 }, { unique: true });

export default mongoose.model<IConversation>(
  "Conversation",
  conversationSchema,
);
