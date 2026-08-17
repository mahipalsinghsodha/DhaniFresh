const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

const MAX_QTY_PER_ITEM = 10; // Maximum quantity of a single product in cart

// Helper: validate MongoDB ObjectId format
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Get user's cart
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
      await cart.save();
    }
    
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add item to cart
router.post('/items', auth, async (req, res) => {
 
  try {
    const { productId, variantId, quantity } = req.body;

    // Validate ObjectId format to prevent CastError HTML 500
    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    if (variantId && !isValidObjectId(variantId)) {
      return res.status(400).json({ message: 'Invalid variant ID format' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let targetStock = product.stock;
    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant) return res.status(404).json({ message: 'Variant not found' });
      targetStock = variant.stock;
    }

    // Block adding out-of-stock products
    if (targetStock <= 0) {
      return res.status(400).json({ message: 'This item is currently not available' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId && 
              (variantId ? item.variant?.toString() === variantId : !item.variant)
    );

    const requestedQty = quantity || 1;
    // Cap = min(targetStock, MAX_QTY_PER_ITEM)
    const maxAllowed = Math.min(targetStock, MAX_QTY_PER_ITEM);

    if (itemIndex > -1) {
      const newQty = cart.items[itemIndex].quantity + requestedQty;
      cart.items[itemIndex].quantity = Math.min(newQty, maxAllowed);
    } else {
      cart.items.push({ 
        product: productId, 
        variant: variantId || null,
        quantity: Math.min(requestedQty, maxAllowed)
      });
    }

    cart.reminderSentAt = null;
    await cart.save();
    await cart.populate('items.product');
    
    res.json(cart);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update cart item quantity
router.put('/items/:itemId', auth, async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Need to populate the product to check stock
    const product = await Product.findById(item.product);
    if (!product) {
       return res.status(404).json({ message: 'Product not found' });
    }
    
    let targetStock = product.stock;
    if (item.variant) {
      const variant = product.variants.id(item.variant);
      if (variant) targetStock = variant.stock;
    }

    // Dynamic cap: min(targetStock, MAX_QTY_PER_ITEM)
    const maxAllowed = Math.min(targetStock, MAX_QTY_PER_ITEM);

    if (quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }
    if (quantity > maxAllowed) {
      return res.status(400).json({ 
        message: `Max ${maxAllowed} of this item allowed (stock: ${targetStock})` 
      });
    }

    item.quantity = quantity;
    cart.reminderSentAt = null;
    await cart.save();
    await cart.populate('items.product');

    res.json(cart);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Remove item from cart
router.delete('/items/:itemId', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(
      item => item._id.toString() !== req.params.itemId
    );

    cart.reminderSentAt = null;
    await cart.save();
    await cart.populate('items.product');

    res.json(cart);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Clear cart
router.delete('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
