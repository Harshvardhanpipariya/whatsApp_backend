import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getAllUsers,
  getAllUsersWithBlockFilter,
  getUserDetails,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getUsersWhoBlockedMe
} from '../controllers/userController.js';

const router = express.Router();

// Basic route - Get all users (simple version)
router.get('/all-users-basic', authMiddleware, getAllUsers);

// Advanced route - Get all users with block filtering
router.get('/allUsers', authMiddleware, getAllUsersWithBlockFilter);

// Get single user details
router.get('/user/:userId', authMiddleware, getUserDetails);

// Block/Unblock routes
router.post('/block/:userId', authMiddleware, blockUser);
router.post('/unblock/:userId', authMiddleware, unblockUser);

// Blocked users lists
router.get('/blocked-users', authMiddleware, getBlockedUsers);
router.get('/users-blocked-me', authMiddleware, getUsersWhoBlockedMe);

export default router;