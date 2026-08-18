const mongoose = require('mongoose');

// Helper: generate a URL-safe slug from product name
const generateSlug = (name) => name
  .toString()
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')   // remove non-word chars
  .replace(/[\s_-]+/g, '-')  // spaces and underscores -> hyphens
  .replace(/^-+|-+$/g, '');  // trim hyphens

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    // Auto-generated from name if not provided
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  price: {
    type: Number,
    min: 0,
    default: null
  },
  mrp: {
    type: Number,
    min: 0,
    default: null
  },
  tags: [{ type: String, lowercase: true, trim: true }],  // e.g. ['a2', 'cow', 'organic']
  stock: {
    type: Number,
    min: 0,
    default: 0
  },
  b2bMinQty: { type: Number, default: 0 },
  b2bSetQty: { type: Number, default: 0 },
  variants: [{
    weight: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0, default: null },
    stock: { type: Number, required: true, min: 0, default: 0 },
    b2bMinQty: { type: Number, default: 0 },
    b2bSetQty: { type: Number, default: 0 }
  }],
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  image: {
    type: String,
    default: 'https://res.cloudinary.com/demo/image/upload/v1/samples/food/fish-vegetables'
  },
  imageLeft: {
    type: String,
    default: ''
  },
  imageRight: {
    type: String,
    default: ''
  },
  imageTop: {
    type: String,
    default: ''
  },
  imagePackage: {
    type: String,
    default: ''
  },
  images: [{
    type: String
  }],
  weight: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  numReviews: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  reviews: [{
    user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:      { type: String, required: true },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    comment:   { type: String, required: true },
    verified:  { type: Boolean, default: false },   // verified purchase
    createdAt: { type: Date, default: Date.now },
  }],
  launchDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ featured: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' }); // Full-text search
productSchema.index({ price: 1 });
// Note: slug has { unique: true } in schema definition — no separate index needed

// Auto-generate slug before save
productSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('name')) {
    let baseSlug = generateSlug(this.name);
    let slug = baseSlug;
    let i = 1;
    // Ensure uniqueness
    while (await mongoose.model('Product').findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${i++}`;
    }
    this.slug = slug;
  }
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
