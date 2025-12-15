import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import User from "../models/User";
import Device from "../models/Device";
import QRToken from "../models/QRToken";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiry,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
} from "../utils/tokenUtils";

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, publicKey, deviceType } = req.body;

    // Validate required fields
    if (!email || !username || !password || !publicKey || !deviceType) {
      res.status(400).json({
        success: false,
        message:
          "Please provide all required fields (email, username, password, publicKey, deviceType)",
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

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message:
          existingUser.email === email
            ? "Email already registered"
            : "Username already taken",
      });
      return;
    }

    // Create new user
    const user = await User.create({
      email,
      username,
      passwordHash: password, // Will be hashed by pre-save hook
      publicKey,
    });

    // Create device for this user
    const deviceId = uuidv4();
    const device = await Device.create({
      userId: user._id,
      deviceId,
      deviceType,
      publicKey,
      isActive: true,
    });

    // Generate tokens
    const accessToken = generateAccessToken(
      user._id.toString(),
      device._id.toString(),
    );
    const refreshToken = generateRefreshToken();
    const hashedRefreshToken = hashRefreshToken(refreshToken);

    // Store hashed refresh token in device
    device.refreshToken = hashedRefreshToken;
    device.refreshTokenExpiresAt = getRefreshTokenExpiry();
    device.lastActiveAt = new Date();
    await device.save();

    // Set tokens in httpOnly cookies
    res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());
    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          publicKey: user.publicKey,
          createdAt: user.createdAt,
        },
        device: {
          _id: device._id,
          deviceId: device.deviceId,
          deviceType: device.deviceType,
        },
        token: accessToken, // Also return token for Socket.IO
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: (error as Error).message,
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, deviceType, publicKey } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
      return;
    }

    // If deviceType and publicKey provided, validate them
    if (deviceType || publicKey) {
      if (!deviceType || !publicKey) {
        res.status(400).json({
          success: false,
          message:
            "Both deviceType and publicKey are required for device registration",
        });
        return;
      }

      if (!["web", "ios", "android"].includes(deviceType)) {
        res.status(400).json({
          success: false,
          message: "Invalid device type. Must be web, ios, or android",
        });
        return;
      }
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
      return;
    }

    // Create device if deviceType and publicKey provided
    let device = null;
    if (deviceType && publicKey) {
      // Check device limit
      const activeDeviceCount = await Device.countDocuments({
        userId: user._id,
        isActive: true,
      });

      if (activeDeviceCount >= 5) {
        res.status(400).json({
          success: false,
          message: "Maximum 5 devices allowed. Please remove a device first.",
        });
        return;
      }

      // Create new device
      const deviceId = uuidv4();
      device = await Device.create({
        userId: user._id,
        deviceId,
        deviceType,
        publicKey,
        isActive: true,
      });

      // Generate tokens
      const accessToken = generateAccessToken(
        user._id.toString(),
        device._id.toString(),
      );
      const refreshToken = generateRefreshToken();
      const hashedRefreshToken = hashRefreshToken(refreshToken);

      // Store hashed refresh token in device
      device.refreshToken = hashedRefreshToken;
      device.refreshTokenExpiresAt = getRefreshTokenExpiry();
      device.lastActiveAt = new Date();
      await device.save();

      // Set tokens in httpOnly cookies
      res.cookie("accessToken", accessToken, getAccessTokenCookieOptions());
      res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

      // Store token for response
      const tokenForResponse = accessToken;

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            _id: user._id,
            email: user.email,
            username: user.username,
            publicKey: user.publicKey,
            createdAt: user.createdAt,
          },
          device: {
            _id: device._id,
            deviceId: device.deviceId,
            deviceType: device.deviceType,
          },
          token: tokenForResponse, // Also return token for Socket.IO
        },
      });
      return;
    } else {
      // No device info provided - cannot set cookies
      res.status(400).json({
        success: false,
        message: "Device type and public key are required for login",
      });
      return;
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: (error as Error).message,
    });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
      return;
    }

    // Hash the refresh token to compare with database
    const hashedToken = hashRefreshToken(refreshToken);

    // Find device with this refresh token
    const device = await Device.findOne({
      refreshToken: hashedToken,
      isActive: true,
      isRevoked: false,
    }).select("+refreshToken");

    if (!device) {
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
      return;
    }

    // Check if refresh token is expired
    if (
      !device.refreshTokenExpiresAt ||
      new Date() > device.refreshTokenExpiresAt
    ) {
      res.status(401).json({
        success: false,
        message: "Refresh token expired",
      });
      return;
    }

    // Generate new tokens (rotation)
    const newAccessToken = generateAccessToken(
      device.userId.toString(),
      device._id.toString(),
    );
    const newRefreshToken = generateRefreshToken();
    const hashedNewRefreshToken = hashRefreshToken(newRefreshToken);

    // Update device with new refresh token
    device.refreshToken = hashedNewRefreshToken;
    device.refreshTokenExpiresAt = getRefreshTokenExpiry();
    device.lastActiveAt = new Date();
    await device.save();

    // Set new tokens in cookies
    res.cookie("accessToken", newAccessToken, getAccessTokenCookieOptions());
    res.cookie("refreshToken", newRefreshToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        token: newAccessToken, // Also return token for Socket.IO
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
      error: (error as Error).message,
    });
  }
};

/**
 * Logout user (current device only)
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      // Hash and find device to revoke tokens
      const hashedToken = hashRefreshToken(refreshToken);
      const device = await Device.findOne({
        refreshToken: hashedToken,
      }).select("+refreshToken");

      if (device) {
        // Clear refresh token from device
        device.refreshToken = null;
        device.refreshTokenExpiresAt = null;
        await device.save();
      }
    }

    // Clear cookies
    res.clearCookie("accessToken", getClearCookieOptions());
    res.clearCookie("refreshToken", getClearCookieOptions());

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging out",
      error: (error as Error).message,
    });
  }
};

/**
 * Verify QR Token for mobile app login
 * POST /api/auth/verify-qr-token
 */
export const verifyQRToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Token is already verified by auth middleware
    // req.userId contains the authenticated user's ID

    const userId = req.userId;

    // Fetch user data
    const user = await User.findById(userId).select("-passwordHash");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Return user data for mobile app
    res.status(200).json({
      success: true,
      message: "Token verified successfully",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          publicKey: user.publicKey,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Verify QR token error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying token",
      error: (error as Error).message,
    });
  }
};

/**
 * Generate QR Token for device login
 * POST /api/auth/qr-token
 */
export const generateQRToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Generate a unique token
    const token = uuidv4();

    // Set expiry to 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create QR token entry
    const qrToken = await QRToken.create({
      token,
      userId,
      expiresAt,
      isUsed: false,
    });

    res.status(201).json({
      success: true,
      message: "QR token generated successfully",
      data: {
        token: qrToken.token,
        expiresAt: qrToken.expiresAt,
      },
    });
  } catch (error) {
    console.error("Generate QR token error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating QR token",
      error: (error as Error).message,
    });
  }
};

/**
 * Verify QR Token and register device (for mobile login)
 * POST /api/auth/qr-login
 */
export const verifyQRTokenAndLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, deviceType, publicKey } = req.body;

    // Validate required fields
    if (!token || !deviceType || !publicKey) {
      res.status(400).json({
        success: false,
        message: "Token, deviceType, and publicKey are required",
      });
      return;
    }

    // Validate device type
    if (!["ios", "android"].includes(deviceType)) {
      res.status(400).json({
        success: false,
        message: "Invalid device type. Must be ios or android",
      });
      return;
    }

    // Find the QR token
    const qrToken = await QRToken.findOne({
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() }, // Not expired
    });

    if (!qrToken) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired QR token",
      });
      return;
    }

    // Get the user
    const user = await User.findById(qrToken.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Check device limit
    const activeDeviceCount = await Device.countDocuments({
      userId: user._id,
      isActive: true,
    });

    if (activeDeviceCount >= 5) {
      res.status(400).json({
        success: false,
        message: "Maximum 5 devices allowed. Please remove a device first.",
      });
      return;
    }

    // Create new device
    const deviceId = uuidv4();
    const device = await Device.create({
      userId: user._id,
      deviceId,
      deviceType,
      publicKey,
      isActive: true,
    });

    // Generate tokens
    const accessToken = generateAccessToken(
      user._id.toString(),
      device._id.toString(),
    );
    const refreshToken = generateRefreshToken();
    const hashedRefreshToken = hashRefreshToken(refreshToken);

    // Store hashed refresh token in device
    device.refreshToken = hashedRefreshToken;
    device.refreshTokenExpiresAt = getRefreshTokenExpiry();
    device.lastActiveAt = new Date();
    await device.save();

    // Mark QR token as used
    qrToken.isUsed = true;
    qrToken.usedAt = new Date();
    await qrToken.save();

    // Return tokens and user data (mobile doesn't use httpOnly cookies)
    res.status(200).json({
      success: true,
      message: "Device registered successfully",
      data: {
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          publicKey: user.publicKey,
          createdAt: user.createdAt,
        },
        device: {
          _id: device._id,
          deviceId: device.deviceId,
          deviceType: device.deviceType,
        },
      },
    });
  } catch (error) {
    console.error("Verify QR token and login error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing QR login",
      error: (error as Error).message,
    });
  }
};
