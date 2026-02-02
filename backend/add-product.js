// Script to add a single product easily
const mongoose = require('mongoose');
const Product = require('./models/Product');
const dotenv = require('dotenv');

dotenv.config();

const addProduct = async () => {
  try {
    // Get product details from command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 5) {
      console.log(`
Usage: node add-product.js <name> <description> <category> <price> <stock> <weight> [image] [featured]

Example:
node add-product.js "Premium A1 Ghee" "Pure natural ghee" a1 450 100 "500g" "https://image-url.com" true

Required fields:
- name: Product name
- description: Product description
- category: a1 or a2
- price: Product price (number)
- stock: Stock quantity (number)
- weight: Product weight (e.g., "500g", "1kg")

Optional fields:
- image: Image URL (default: placeholder)
- featured: true/false (default: false)
      `);
      process.exit(1);
    }

    const [name, description, category, price, stock, weight, image, featured] = args;

    // Validate category
    if (category !== 'a1' && category !== 'a2') {
      console.error('Error: Category must be "a1" or "a2"');
      process.exit(1);
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ghee-ecommerce');
    console.log('Connected to MongoDB');

    // Create product
    const productData = {
      name,
      description,
      category: category.toLowerCase(),
      price: parseFloat(price),
      stock: parseInt(stock),
      weight,
      image: image || 'https://via.placeholder.com/400x400?text=Ghee+Product',
      featured: featured === 'true' || featured === 'True'
    };

    const product = new Product(productData);
    await product.save();

    console.log('\n✅ Product added successfully!');
    console.log('Product Details:');
    console.log(JSON.stringify(product, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error adding product:', error.message);
    process.exit(1);
  }
};

addProduct();
