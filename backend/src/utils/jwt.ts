import jwt from "jsonwebtoken";
import { IJWTPayload } from "../types/interfaces";

/**
 * Generate JWT token for user
 * @param {String} userId - User's MongoDB ObjectId
 * @returns {String} JWT token
 */
export const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRE || "7d" } as jwt.SignOptions,
  );
};

/**
 * Verify JWT token
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token: string): IJWTPayload => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string) as IJWTPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
