import express from 'express';
import * as conversationController from '../controllers/conversationController';
import auth from '../middleware/auth';

const router = express.Router();

// POST /api/conversations - Create new conversation (protected)
router.post('/', auth, conversationController.createConversation);

// POST /api/conversations/get-or-create - Get or create conversation (protected)
router.post('/get-or-create', auth, conversationController.getOrCreateConversation);

// GET /api/conversations - Get all conversations for logged-in user (protected)
router.get('/', auth, conversationController.getConversations);

// GET /api/conversations/:conversationId - Get specific conversation (protected)
router.get('/:conversationId', auth, conversationController.getConversation);

export default router;