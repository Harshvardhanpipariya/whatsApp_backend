// src/routes/authRoutes.js

import express from 'express'

import upload from '../middleware/multer.js';

import {
  loginUser,
  sendOTP,
  verifyOTP,
  completeSignup
} from '../controllers/authController.js'

const router = express.Router()

router.post(
  '/login',
  loginUser
)

router.post(
  '/verify-otp',
  verifyOTP
);

router.post(
  '/send-otp',
  sendOTP
)

router.post(
  '/complete-signup',
  upload.single('photo'),
  completeSignup
);





export default router