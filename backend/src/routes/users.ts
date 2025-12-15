import express from 'express';
import * as userController from '../controllers/userController';
import auth from '../middleware/auth';

const router = express.Router();

// Test endpoint without auth
router.get('/test', (_req, res) => {
  res.json({ success: true, message: 'Users route is working!' });
});

// GET /api/users/me - Get current user profile (protected)
// This MUST come before '/' to avoid being caught by the generic route
router.get('/me', (req, res, next) => {
  next();
}, auth, userController.getMe);

// GET /api/users/:userId/publicKey - Get user's public key (protected)
router.get('/:userId/publicKey', (req, res, next) => {
  next();
}, auth, userController.getUserPublicKey);

// PUT /api/users/me/publicKey - Update current user's public key (protected)
router.put('/me/publicKey', (req, res, next) => {
  next();
}, auth, userController.updatePublicKey);

// GET /api/users - Get all users (protected)
// This comes last because it's the most generic
router.get('/', (req, res, next) => {
  next();
}, auth, userController.getAllUsers);

export default router;