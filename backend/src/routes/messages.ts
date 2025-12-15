import express from 'express';
import * as messageController from '../controllers/messageController';
import auth from '../middleware/auth';

const router = express.Router();

// POST /api/messages - Send new message (protected)
router.post('/', auth, messageController.sendMessage);

// GET /api/messages/:conversationId - Get messages for conversation (protected)
router.get('/:conversationId', auth, messageController.getMessages);

export default router;