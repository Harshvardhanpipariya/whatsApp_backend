import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getMessages,
  getChatHistory,
  getConversations,
  clearConversation,
  deleteMessage,
  markMessagesAsRead,
  getUnreadCount
} from '../controllers/messageController.js';

const router = express.Router();

// Existing route - Get messages between two users (simple version)
router.get('/:userId', authMiddleware, getMessages);

// Get chat history with limit (alternative version)
router.get('/history/:userId', authMiddleware, getChatHistory);

// Get all conversations for current user
router.get('/conversations/all', authMiddleware, getConversations);

// Clear entire conversation
router.delete('/conversation/clear', authMiddleware, clearConversation);

// Mark messages as read
router.put('/mark-read', authMiddleware, markMessagesAsRead);

// Get unread message count
router.get('/unread/count', authMiddleware, getUnreadCount);

// Delete a single message
router.delete('/message/:messageId', authMiddleware, deleteMessage);

export default router;