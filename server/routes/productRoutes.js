const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order   = require('../models/Order');
const auth = require('../middleware/auth');
const { logAction } = require('../utils/logger');
const dbCheck = require('../middleware/dbCheck');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// Validation middleware for product creation/updates
const validateProduct = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('price').isNumeric().withMessage('Price must be a valid number').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  body('mrp').optional().isNumeric().withMessage('MRP must be a valid number').isFloat({ min: 0 }).withMessage('MRP must be non-negative'),
  body('category').notEmpty().withMessage('Category is required'),
  body('stock').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('image').optional({ nullable: true }).isString().trim(),
  body('imageLeft').optional({ nullable: true }).isString().trim(),
  body('imageRight').optional({ nullable: true }).isString().trim(),
  body('imageTop').optional({ nullable: true }).isString().trim(),
  body('imagePackage').optional({ nullable: true }).isString().trim(),
  body('isActive').optional().isBoolean()
];

// Whitelist of fields that clients may set on a product
const ALLOWED_PRODUCT_FIELDS = [
  'name', 'description', 'price', 'mrp', 'image', 'imageLeft', 'imageRight', 'imageTop', 'imagePackage', 'images', 'category',
  'stock', 'weight', 'featured', 'isActive', 'tags', 'launchDate', 'variants', 'b2bMinQty', 'b2bSetQty'
];

const pickAllowed = (body) => {
  const data = {};
  for (const field of ALLOWED_PRODUCT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }
  return data;
};

// Get products with server-side pagination, sort, and search
router.get('/', dbCheck, async (req, res) => {
  try {
    const {
      category, featured, search, deals,
      page    = 1,
      limit   = 12,
      sort    = 'default',
      all,          // admin flag: include inactive
    } = req.query;

    const query = {};

    // ── Active filter (skip for admin "all" flag) ──────────────────────────
    if (all !== 'true') {
      query.isActive = { $ne: false };
    }

    if (category) query.category = category;
    if (featured === 'true') query.featured = true;
    if (deals === 'true') {
      query.$expr = { $gt: ["$mrp", "$price"] };
    }
    if (req.query.comingSoon === 'true') {
      query.launchDate = { $gt: new Date() };
    } else {
      // For normal product listings, we generally don't want to show coming soon products unless requested.
      // However, to avoid breaking existing behavior where they might be shown, we'll only exclude them if comingSoon is false
      if (req.query.comingSoon === 'false') {
         query.launchDate = { $not: { $gt: new Date() } };
      }
    }

    //  Search: use $regex for partial substring matching
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { description: regex },
        { tags: regex }
      ];
    }

    // ── Sort ──────────────────────────────────────────────────────────────
    const sortMap = {
      default:    { createdAt: -1 },
      price_asc:  { price: 1 },
      price_desc: { price: -1 },
      rating:     { rating: -1 },
      newest:     { createdAt: -1 },
    };
    const mongoSort = sortMap[sort] || { createdAt: -1 };

    // ── Pagination ────────────────────────────────────────────────────────
    const pageNum   = Math.max(1, parseInt(page)  || 1);
    const limitNum  = Math.min(48, Math.max(1, parseInt(limit) || 12)); // cap at 48
    const skip      = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(query).sort(mongoSort).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      products,
      total,
      page:  pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      message: error.message || 'Error fetching products',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// ========================================================================
// ADMIN: GET INVENTORY
// ========================================================================
router.get('/admin/inventory', auth, auth.admin, auth.hasPermission('products'), async (req, res) => {
  try {
    const { lowStock } = req.query;
    const query = {};
    if (lowStock === 'true') {
      query.stock = { $lt: 10 };
    }
    const products = await Product.find(query)
      .select('name image price stock category isActive mrp')
      .sort({ stock: 1, name: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single product
router.get('/:id', dbCheck, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ 
      message: error.message || 'Error fetching product',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========================================================================
// ADMIN: BULK IMPORT PRODUCTS (CSV)
// ========================================================================
router.post('/import/csv', auth, auth.admin, auth.hasPermission('products'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const results = [];
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        for (const [index, row] of results.entries()) {
          try {
            // Validate required fields
            if (!row.name || !row.price || !row.category) {
              throw new Error('Missing required fields (name, price, category)');
            }

            const productData = {
              name: row.name.trim(),
              description: row.description?.trim() || '',
              price: Number(row.price),
              mrp: row.mrp ? Number(row.mrp) : undefined,
              category: row.category.trim(),
              stock: row.stock ? parseInt(row.stock, 10) : 0,
              weight: row.weight?.trim() || '500g',
              isActive: row.isActive ? row.isActive.toLowerCase() === 'true' : true,
              featured: row.featured ? row.featured.toLowerCase() === 'true' : false,
              image: row.image?.trim() || '',
              imageLeft: row.imageLeft?.trim() || '',
              imageRight: row.imageRight?.trim() || '',
              imageTop: row.imageTop?.trim() || '',
              imagePackage: row.imagePackage?.trim() || '',
              launchDate: row.launchDate ? new Date(row.launchDate) : undefined,
              variants: row.variants ? JSON.parse(row.variants) : [],
              b2bMinQty: row.b2bMinQty ? parseInt(row.b2bMinQty, 10) : 1,
              b2bSetQty: row.b2bSetQty ? parseInt(row.b2bSetQty, 10) : 1,
            };

            // Check if product exists (by name)
            const existing = await Product.findOne({ name: productData.name });
            if (existing) {
              await Product.updateOne({ _id: existing._id }, productData);
            } else {
              await Product.create(productData);
            }
            successCount++;
          } catch (err) {
            errorCount++;
            errors.push(`Row ${index + 2}: ${err.message}`);
          }
        }

        // Clean up file
        fs.unlinkSync(req.file.path);

        res.json({
          message: 'Import complete',
          successCount,
          errorCount,
          errors: errors.slice(0, 10) // Send up to 10 errors
        });
      } catch (err) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Failed to process CSV data' });
      }
    })
    .on('error', (error) => {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ message: 'Failed to parse CSV file', error: error.message });
    });
});

// Create product (Admin with 'products' permission or Superadmin)
router.post('/', auth, auth.admin, auth.hasPermission('products'), validateProduct, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const safeData = pickAllowed(req.body);
    const product = new Product(safeData);
    await product.save();
    
    await logAction(req, 'CREATE_PRODUCT', 'PRODUCT', product._id, {
      name: product.name,
      price: product.price,
      category: product.category
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update product (Admin with 'products' permission or Superadmin)
router.put('/:id', auth, auth.admin, auth.hasPermission('products'), validateProduct, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const oldProduct = await Product.findById(req.params.id);
    if (!oldProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const safeData = pickAllowed(req.body);
    Object.assign(oldProduct, safeData);
    const product = await oldProduct.save();

    await logAction(req, 'UPDATE_PRODUCT', 'PRODUCT', product._id, {
      name: product.name,
      changes: safeData
    });

    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ========================================================================
// ADMIN: UPDATE STOCK INLINE
// ========================================================================
router.put('/:id/stock', auth, auth.admin, auth.hasPermission('products'), async (req, res) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || isNaN(stock) || stock < 0) {
      return res.status(400).json({ message: 'Valid non-negative stock value is required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.stock = Number(stock);
    await product.save();
    
    await logAction(req, 'UPDATE_STOCK', 'PRODUCT', product._id, { stock });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete product (Admin with 'products' permission or Superadmin)
router.delete('/:id', auth, auth.admin, auth.hasPermission('products'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await logAction(req, 'DELETE_PRODUCT', 'PRODUCT', product._id, {
      name: product.name
    });

    await product.deleteOne();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ── Check review eligibility (has delivered order + not yet reviewed) ─────────
router.get('/:id/review-eligibility', auth, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId    = req.user._id;

    // Has the user received a delivered order containing this product?
    const deliveredOrder = await Order.findOne({
      user:        userId,
      isDelivered: true,
      'orderItems.product': productId,
    });

    const product = await Product.findById(productId).select('reviews');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const alreadyReviewed = (product.reviews || []).some(
      r => r.user.toString() === userId.toString()
    );

    res.json({
      eligible:        !!deliveredOrder && !alreadyReviewed,
      hasDelivered:    !!deliveredOrder,
      alreadyReviewed,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;
