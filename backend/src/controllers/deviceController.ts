import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import Device from "../models/Device";
import User from "../models/User";

/**
 * Register a new device
 * POST /api/devices
 */
export const registerDevice = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { deviceType, publicKey } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!deviceType || !publicKey) {
      res.status(400).json({
        success: false,
        message: "Device type and public key are required",
      });
      return;
    }

    // Validate device type
    if (!["web", "ios", "android"].includes(deviceType)) {
      res.status(400).json({
        success: false,
        message: "Invalid device type. Must be web, ios, or android",
      });
      return;
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Check device limit (max 5 devices per user)
    const activeDeviceCount = await Device.countDocuments({
      userId,
      isActive: true,
    });

    if (activeDeviceCount >= 5) {
      res.status(400).json({
        success: false,
        message: "Maximum 5 devices allowed. Please remove a device first.",
      });
      return;
    }

    // Generate unique device ID
    const deviceId = uuidv4();

    // Create new device
    const device = await Device.create({
      userId,
      deviceId,
      deviceType,
      publicKey,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Device registered successfully",
      data: {
        device: {
          _id: device._id,
          deviceId: device.deviceId,
          deviceType: device.deviceType,
          publicKey: device.publicKey,
          isActive: device.isActive,
          createdAt: device.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Register device error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering device",
      error: (error as Error).message,
    });
  }
};

/**
 * Get all devices for current user
 * GET /api/devices/me
 */
export const getMyDevices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;

    const devices = await Device.find({ userId, isActive: true })
      .select("_id deviceId deviceType publicKey isActive createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        devices,
        count: devices.length,
        maxDevices: 5,
      },
    });
  } catch (error) {
    console.error("Get devices error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching devices",
      error: (error as Error).message,
    });
  }
};

/**
 * Remove a device
 * DELETE /api/devices/:deviceId
 */
export const removeDevice = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    // Find device
    const device = await Device.findOne({ deviceId, userId });

    if (!device) {
      res.status(404).json({
        success: false,
        message: "Device not found",
      });
      return;
    }

    // Mark as inactive instead of deleting (to preserve message history)
    device.isActive = false;
    await device.save();

    res.status(200).json({
      success: true,
      message: "Device removed successfully",
    });
  } catch (error) {
    console.error("Remove device error:", error);
    res.status(500).json({
      success: false,
      message: "Error removing device",
      error: (error as Error).message,
    });
  }
};

/**
 * Mark device as active (for re-activation)
 * PUT /api/devices/:deviceId/active
 */
export const markDeviceActive = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    // Check device limit before reactivating
    const activeDeviceCount = await Device.countDocuments({
      userId,
      isActive: true,
    });

    if (activeDeviceCount >= 5) {
      res.status(400).json({
        success: false,
        message: "Maximum 5 devices allowed. Please remove a device first.",
      });
      return;
    }

    // Find and update device
    const device = await Device.findOneAndUpdate(
      { deviceId, userId },
      { isActive: true },
      { new: true },
    );

    if (!device) {
      res.status(404).json({
        success: false,
        message: "Device not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Device activated successfully",
      data: {
        device: {
          _id: device._id,
          deviceId: device.deviceId,
          deviceType: device.deviceType,
          isActive: device.isActive,
        },
      },
    });
  } catch (error) {
    console.error("Activate device error:", error);
    res.status(500).json({
      success: false,
      message: "Error activating device",
      error: (error as Error).message,
    });
  }
};

/**
 * Get all active devices for a specific user (for encryption purposes)
 * GET /api/devices/user/:userId
 */
export const getUserDevices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    // Verify the requesting user has permission (either the user themselves or has a conversation with them)
    // For now, we'll allow any authenticated user to get device info for encryption purposes
    // In production, you might want to restrict this to conversation participants only

    const devices = await Device.find({ userId, isActive: true })
      .select("_id deviceId deviceType publicKey isActive createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        devices,
      },
    });
  } catch (error) {
    console.error("Get user devices error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user devices",
      error: (error as Error).message,
    });
  }
};

/**
 * Get single device by _id (for fetching public key during decryption)
 * GET /api/devices/:deviceId
 */
export const getDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId).select(
      "_id deviceId deviceType publicKey isActive createdAt",
    );

    if (!device) {
      res.status(404).json({
        success: false,
        message: "Device not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        device,
      },
    });
  } catch (error) {
    console.error("Get device error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching device",
      error: (error as Error).message,
    });
  }
};
