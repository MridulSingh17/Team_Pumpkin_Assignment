import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Device from '../models/Device';
import { verifyAccessToken } from '../utils/tokenUtils';

const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from cookie (primary) or Authorization header (fallback for mobile)
    const token = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No authentication token, access denied'
      });
      return;
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    // Find user by id
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found, token is invalid'
      });
      return;
    }

    // Verify device exists and is active
    const device = await Device.findOne({
      _id: decoded.deviceId,
      userId: decoded.userId,
      isActive: true,
      isRevoked: false,
    });

    if (!device) {
      res.status(401).json({
        success: false,
        message: 'Device not found or inactive'
      });
      return;
    }

    // Attach user and deviceId to request object
    req.user = user;
    req.userId = user._id;
    req.deviceId = decoded.deviceId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

export default auth;