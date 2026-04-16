const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Order = require('../models/Order');

// Initialize Razorpay
// Note: In a real app, these should be in .env
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

/**
 * @route POST /api/payments/create-order
 * @desc Create a Razorpay order
 * @access Private
 */
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || !orderId) {
      return res.status(400).json({ message: 'Amount and Order ID are required' });
    }

    const options = {
      amount: Math.round(amount * 100), // amount in the smallest currency unit (paise for INR)
      currency: 'INR',
      receipt: orderId,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Update the local order with the Razorpay Order ID
    await Order.findByIdAndUpdate(orderId, {
      razorpayOrderId: razorpayOrder.id,
    });

    res.json(razorpayOrder);
  } catch (error) {
    console.error('Razorpay Create Order Error:', error);
    res.status(500).json({ message: 'Failed to create Razorpay order', error: error.message });
  }
});

/**
 * @route POST /api/payments/verify
 * @desc Verify Razorpay payment signature
 * @access Private
 */
router.post('/verify', auth, async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      orderId 
    } = req.body;

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      // Payment is successful
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      order.paymentStatus = 'completed';
      order.status = 'confirmed'; // Update order status as well
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      await order.save();

      return res.json({ message: 'Payment verified successfully' });
    } else {
      // Invalid signature
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'failed',
      });
      return res.status(400).json({ message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Razorpay Verification Error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;
