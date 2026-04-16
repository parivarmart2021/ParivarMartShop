const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const auth = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST standard signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || '',
    });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// POST standard login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.isBlocked) {
       return res.status(403).json({ message: 'Account blocked' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST Google login
router.post('/google-login', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }

    // Verify Google token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      console.error('Google token verification failed:', error.message);
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        profilePic: picture || '',
        googleId: googleId || '',
      });
    } else {
      // Update profile info
      user.name = name || user.name;
      user.profilePic = picture || user.profilePic;
      user.googleId = googleId || user.googleId;
      await user.save();
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Contact support.' });
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token: jwtToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        phone: user.phone,
        addresses: user.addresses,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// GET user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone;
    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST add address
router.post('/address', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { label, fullName, phone, addressLine1, addressLine2, city, state, pincode, isDefault } = req.body;

    // If this is set as default, unset all others
    if (isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    // If first address, make it default
    if (user.addresses.length === 0) {
      req.body.isDefault = true;
    }

    user.addresses.push({
      label, fullName, phone, addressLine1, addressLine2, city, state, pincode,
      isDefault: isDefault || user.addresses.length === 0,
    });
    await user.save();

    res.status(201).json(user.addresses);
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update address
router.put('/address/:addressId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ message: 'Address not found' });

    if (req.body.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    Object.assign(address, req.body);
    await user.save();

    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE address
router.delete('/address/:addressId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== req.params.addressId
    );
    await user.save();

    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

const crypto = require('crypto');
const nodemailer = require('nodemailer');

// POST forgot password (OTP)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: 'User with this email does not exist.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOTP = otp;
    user.resetOTPExpires = Date.now() + 600000; // 10 minutes
    await user.save();

    // Send email logic
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Explicitly verify connection
    try {
      await transporter.verify();
      console.log('[AUTH] SMTP Connection Verified');
    } catch (verifyError) {
      console.error('[AUTH] SMTP Verification Failed:', verifyError.message);
    }

    const mailOptions = {
      from: `"Parivar Mart Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset OTP - Parivar Mart',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #e0fdfd; border-radius: 20px; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0FC2C0; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">Parivar Mart</h1>
          </div>
          <h2 style="color: #023535; font-size: 22px; margin-bottom: 20px;">Password Reset Request</h2>
          <p style="color: #555; line-height: 1.6; font-size: 16px;">Someone requested a password reset for your account. Use the code below to proceed. This code expires in <strong>10 minutes</strong>.</p>
          
          <div style="background: linear-gradient(135deg, #0FC2C0 0%, #008F8C 100%); padding: 20px; border-radius: 15px; text-align: center; margin: 30px 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 900; color: #ffffff; letter-spacing: 12px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${otp}</span>
          </div>
          
          <p style="color: #888; font-size: 14px; margin-top: 30px; text-align: center;">If you did not request this, please ignore this email or contact support.</p>
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center; color: #aaa; font-size: 12px;">
            © 2026 Parivar Mart Supermarket. All rights reserved.
          </div>
        </div>
      `
    };

    // Attempt to send
    try {
      await transporter.sendMail(mailOptions);
    } catch (err) {
      console.error('Email error:', err.message);
      // In production, we might log this but still return success to the user
    }

    res.json({ message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetOTP: otp,
      resetOTPExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST reset password (OTP based)
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetOTP: otp,
      resetOTPExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired session. Please try again.' });
    }

    user.password = password;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been updated successfully!' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
