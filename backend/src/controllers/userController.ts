import { Request, Response } from "express";
import User from "../models/User";

export const getAllUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUserId = req.userId;

    // Get all users except the current user
    const users = await User.find({ _id: { $ne: currentUserId } }).select(
      "username email publicKey createdAt",
    );

    res.status(200).json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: (error as Error).message,
    });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user profile",
      error: (error as Error).message,
    });
  }
};

export const getUserPublicKey = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("publicKey username");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Get public key error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching public key",
      error: (error as Error).message,
    });
  }
};

export const updatePublicKey = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { publicKey } = req.body;
    const currentUserId = req.userId;

    if (!publicKey) {
      res.status(400).json({
        success: false,
        message: "Public key is required",
      });
      return;
    }

    // Update user's public key
    const user = await User.findByIdAndUpdate(
      currentUserId,
      { publicKey },
      { new: true },
    ).select("-passwordHash");

    if (!user) {
      console.error("User not found with ID:", currentUserId);
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Public key updated successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Update public key error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating public key",
      error: (error as Error).message,
    });
  }
};
