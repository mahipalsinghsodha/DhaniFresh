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
    let b2bMinQty = product.b2bMinQty || 0;
    let b2bSetQty = product.b2bSetQty || 0;
    
    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant) return res.status(404).json({ message: 'Variant not found' });
      targetStock = variant.stock;
      if (variant.b2bMinQty > 0) b2bMinQty = variant.b2bMinQty;
      if (variant.b2bSetQty > 0) b2bSetQty = variant.b2bSetQty;
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
    const isB2B = req.user.role === 'b2b_customer';
    
    // Cap = targetStock for B2B, otherwise min(targetStock, MAX_QTY_PER_ITEM)
    const maxAllowed = isB2B ? targetStock : Math.min(targetStock, MAX_QTY_PER_ITEM);

    let newQty = requestedQty;
    if (itemIndex > -1) {
      newQty = cart.items[itemIndex].quantity + requestedQty;
    }
    newQty = Math.min(newQty, maxAllowed);
    
    // B2B Constraints check
    if (isB2B && b2bMinQty > 0) {
       if (newQty < b2bMinQty) {
          return res.status(400).json({ message: `Minimum B2B order quantity is ${b2bMinQty}` });
       }
       if (b2bSetQty > 0 && (newQty - b2bMinQty) % b2bSetQty !== 0) {
          return res.status(400).json({ message: `B2B orders must be in increments of ${b2bSetQty} after the minimum of ${b2bMinQty}` });
       }
    }

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = newQty;
    } else {
      cart.items.push({ 
        product: productId, 
        variant: variantId || null,
        quantity: newQty
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
    let b2bMinQty = product.b2bMinQty || 0;
    let b2bSetQty = product.b2bSetQty || 0;
    if (item.variant) {
      const variant = product.variants.id(item.variant);
      if (variant) {
        targetStock = variant.stock;
        if (variant.b2bMinQty > 0) b2bMinQty = variant.b2bMinQty;
        if (variant.b2bSetQty > 0) b2bSetQty = variant.b2bSetQty;
      }
    }

    const isB2B = req.user.role === 'b2b_customer';
    // Dynamic cap: targetStock for B2B, otherwise min(targetStock, MAX_QTY_PER_ITEM)
    const maxAllowed = isB2B ? targetStock : Math.min(targetStock, MAX_QTY_PER_ITEM);

    if (quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }
    if (quantity > maxAllowed) {
      return res.status(400).json({ 
        message: `Max ${maxAllowed} of this item allowed (stock: ${targetStock})` 
      });
    }
    
    // B2B Constraints check
    if (isB2B && b2bMinQty > 0) {
       if (quantity < b2bMinQty) {
          return res.status(400).json({ message: `Minimum B2B order quantity is ${b2bMinQty}` });
       }
       if (b2bSetQty > 0 && (quantity - b2bMinQty) % b2bSetQty !== 0) {
          return res.status(400).json({ message: `B2B orders must be in increments of ${b2bSetQty} after the minimum of ${b2bMinQty}` });
       }
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
