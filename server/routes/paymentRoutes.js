const express = require('express')
const {
  createRazorpayOrder,
  verifyPayment,
  razorpayWebhook
} = require('../controllers/paymentController')
const auth = require('../middleware/auth')

const router = express.Router()

router.post('/create-order', auth.optional, createRazorpayOrder)
router.post('/verify', auth.optional, verifyPayment)
router.post('/webhook', razorpayWebhook)

module.exports = router
