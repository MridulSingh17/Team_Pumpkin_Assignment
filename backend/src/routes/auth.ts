import express from "express";
import * as authController from "../controllers/authController";
import auth from "../middleware/auth";

const router = express.Router();

// POST /api/auth/register - Register a new user
router.post("/register", authController.register);

// POST /api/auth/login - Login user
router.post("/login", authController.login);

// POST /api/auth/refresh - Refresh access token
router.post("/refresh", authController.refresh);

// POST /api/auth/logout - Logout user
router.post("/logout", authController.logout);

// POST /api/auth/verify-qr-token - Verify QR login token for mobile app
router.post("/verify-qr-token", auth, authController.verifyQRToken);

// POST /api/auth/qr-token - Generate QR token for device login (protected)
router.post("/qr-token", auth, authController.generateQRToken);

// POST /api/auth/qr-login - Verify QR token and register device (public)
router.post("/qr-login", authController.verifyQRTokenAndLogin);

export default router;
