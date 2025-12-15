import express from 'express';
import * as deviceController from '../controllers/deviceController';
import auth from '../middleware/auth';

const router = express.Router();

// POST /api/devices - Register a new device
router.post('/', auth, deviceController.registerDevice);

// GET /api/devices/me - Get all devices for current user
router.get('/me', auth, deviceController.getMyDevices);

// GET /api/devices/user/:userId - Get all devices for a specific user
router.get('/user/:userId', auth, deviceController.getUserDevices);

// DELETE /api/devices/:deviceId - Remove a device
router.delete('/:deviceId', auth, deviceController.removeDevice);

// PUT /api/devices/:deviceId/active - Mark device as active
router.put('/:deviceId/active', auth, deviceController.markDeviceActive);

export default router;