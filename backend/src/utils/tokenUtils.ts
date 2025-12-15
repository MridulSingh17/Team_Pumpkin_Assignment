import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Token configuration
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

/**
 * Generate access token (JWT)
 */
export const generateAccessToken = (userId: string, deviceId: string): string => {
  return jwt.sign(
    {
      userId,
      deviceId,
      type: 'access'
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * Generate refresh token (random string)
 */
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash refresh token for storage
 */
export const hashRefreshToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Get refresh token expiry date (30 days from now)
 */
export const getRefreshTokenExpiry = (): Date => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiryDate;
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): { userId: string; deviceId: string } | null => {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as any;

    if (decoded.type !== 'access') {
      return null;
    }

    return {
      userId: decoded.userId,
      deviceId: decoded.deviceId,
    };
  } catch (error) {
    return null;
  }
};

/**
 * Check if refresh token is expired
 */
export const isRefreshTokenExpired = (expiresAt: Date): boolean => {
  return new Date() > new Date(expiresAt);
};

/**
 * Cookie options for access token
 */
export const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
  path: '/',
});

/**
 * Cookie options for refresh token
 */
export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  path: '/',
});

/**
 * Cookie options for clearing tokens
 */
export const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
});