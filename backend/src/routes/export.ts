import express from 'express';
import * as exportController from '../controllers/exportController';
import auth from '../middleware/auth';

const router = express.Router();

// POST /api/export - Export conversation (protected)
router.post('/', auth, exportController.exportConversation);

// POST /api/import - Import conversation (protected)
router.post('/import', auth, exportController.importConversation);

export default router;