// src/controllers/authController.js

import User from '../models/user.js'

import bcrypt from 'bcryptjs'

import jwt from 'jsonwebtoken'

import cloudinary from '../config/cloudinary.js';

import sendEmail from '../utils/sendEmail.js'

import fs from 'fs';

/*
=====================================
TEMP OTP STORE
=====================================
*/

const otpStore = {}

/*
=====================================
LOGIN USER
=====================================
*/

export const loginUser = async (
  req,
  res
) => {
  try {
    const { email, password } =
      req.body

    // validation
    if (!email || !password) {
      return res.status(400).json({
        message:
          'All fields are required',
      })
    }

    // find user
    const user = await User.findOne({
      email,
    })

    if (!user) {
      return res.status(404).json({
        message:
          'User not found',
      })
    }

    // compare password
    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      )

    if (!isMatch) {
      return res.status(400).json({
        message:
          'Invalid credentials',
      })
    }

    // remove password
    const safeUser =
      await User.findById(
        user._id
      ).select('-password')

    // generate token
    const token = jwt.sign(
      {
        id: user._id,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: '7d',
      }
    )

    res.status(200).json({
      success: true,

      token,

      user: safeUser,
    })
  } catch (error) {
    console.log(error)

    res.status(500).json({
      message:
        'Server Error',
    })
  }
}

/*
=====================================
SEND OTP
=====================================
*/

export const sendOTP = async (req, res) => {
  try {
    const { name, email, password } = req.body

    console.log('=== SEND OTP DEBUG ===');
    console.log('1. Received data:', { name, email, password: '***' });
    console.log('2. Email credentials:', {
      user: process.env.EMAIL_USER ? '✅ Set' : '❌ Missing',
      pass: process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing'
    });

    // validation
    if (!name || !email || !password) {
      console.log('3. Validation failed');
      return res.status(400).json({
        message: 'All fields are required',
      })
    }

    console.log('4. Validation passed');

    // existing user
    console.log('5. Checking existing user...');
    const existingUser = await User.findOne({ email })

    if (existingUser) {
      console.log('6. User already exists');
      return res.status(400).json({
        message: 'User already exists',
      })
    }

    console.log('7. User does not exist, generating OTP...');

    // generate otp
    const otp = Math.floor(100000 + Math.random() * 900000)
    console.log('8. OTP generated:', otp);

    // hash password
    console.log('9. Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10)
    console.log('10. Password hashed');

    // store temporary signup data
    console.log('11. Storing in OTP store...');
    otpStore[email] = {
      name,
      email,
      password: hashedPassword,
      otp,
      expiresAt: Date.now() + 2 * 60 * 1000,
    }
    console.log('12. Stored in OTP store');

    // send otp email
    console.log('13. Attempting to send email to:', email);
    try {
      await sendEmail(
        email,
        'WhatsApp OTP Verification',
        `Your OTP is ${otp}`
      )
      console.log('14. Email sent successfully!');
    } catch (emailError) {
      console.error('15. Email failed:', emailError.message);
      // Still return success for testing
      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        otp: otp, // Include OTP in response for debugging
        debug: 'Email failed but OTP is generated'
      })
    }

    console.log('15. Sending success response');
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
    })
    
  } catch (error) {
    console.error('❌ ERROR in sendOTP:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

/*
=====================================
VERIFY OTP
=====================================
*/



export const verifyOTP = async (
  req,
  res
) => {

  try {

    const { email, otp } =
      req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message:
          'Email and OTP required',
      });
    }

    const storedData =
      otpStore[email];

    if (!storedData) {
      return res.status(400).json({
        message:
          'OTP expired',
      });
    }

    if (
      Date.now() >
      storedData.expiresAt
    ) {

      delete otpStore[email];

      return res.status(400).json({
        message:
          'OTP expired',
      });
    }

    if (
      storedData.otp !==
      Number(otp)
    ) {

      return res.status(400).json({
        message:
          'Invalid OTP',
      });
    }

    /*
    MARK VERIFIED
    */

    storedData.verified = true;

    res.status(200).json({
      success: true,
      message:
        'OTP verified',
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message:
        'Server Error',
    });
  }
};




export const completeSignup =
  async (req, res) => {

    try {

      const { email } = req.body;

      const storedData =
        otpStore[email];

      if (!storedData) {
        return res.status(400).json({
          message:
            'Signup session expired',
        });
      }

      if (!storedData.verified) {
        return res.status(400).json({
          message:
            'OTP not verified',
        });
      }

      /*
      PHOTO
      */

      /*
  PHOTO
  */

      let photoUrl =
        'https://res.cloudinary.com/dyfwgxgeh/image/upload/v1780563521/istockphoto-1337144146-612x612_y00xld.jpg';

        if (req.file) {

          const result =
            await cloudinary.uploader.upload(
              req.file.path,
              {
                folder:
                  'chat-app-users',
              }
            );
        
          photoUrl =
            result.secure_url;
        
          fs.unlink(
            req.file.path,
            (err) => {
        
              if (err) {
        
                console.error(
                  'Failed to delete file:',
                  err
                );
        
              }
        
            }
          );
        
        }

      /*
      CREATE USER
      */

      const user =
        await User.create({

          name:
            storedData.name,

          email:
            storedData.email,

          password:
            storedData.password,

          photo:
            photoUrl,
        });

      /*
      DELETE TEMP DATA
      */

      delete otpStore[email];

      /*
      TOKEN
      */

      const token = jwt.sign(
        {
          id: user._id,
        },

        process.env.JWT_SECRET,

        {
          expiresIn: '7d',
        }
      );

      const safeUser =
        await User.findById(
          user._id
        ).select('-password');

      res.status(201).json({

        success: true,

        token,

        user: safeUser,
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message:
          'Server Error',
      });
    }
  };



