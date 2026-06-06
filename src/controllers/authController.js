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

    // validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'All fields are required',
      })
    }

    // existing user
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists',
      })
    }

    // generate otp
    const otp = Math.floor(100000 + Math.random() * 900000)

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // store temporary signup data
    otpStore[email] = {
      name,
      email,
      password: hashedPassword,
      otp,
      expiresAt: Date.now() + 2 * 60 * 1000,
    }

    // ⭐ TEMPORARY FIX: Skip email, log OTP to console
    console.log(`=========================================`)
    console.log(`📧 OTP for ${email}: ${otp}`)
    console.log(`=========================================`)

    // Return OTP in response for testing (remove in production)
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      otp: otp  // Frontend can use this directly
    })
    
  } catch (error) {
    console.error(error)
    res.status(500).json({
      message: 'Server Error',
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



