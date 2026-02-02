const mongoose = require('mongoose');
const Product = require('./models/Product');
const dotenv = require('dotenv');

dotenv.config();

const products = [
  {
    name: 'Premium A1 Ghee - 500g',
    description: 'Pure and natural A1 ghee made from traditional methods. Rich in flavor and aroma, perfect for cooking and daily consumption.',
    category: 'a1',
    price: 450,
    stock: 100,
    weight: '500g',
    image: 'https://images.unsplash.com/photo-1606914509763-623b1c80d2f3?w=400&h=400&fit=crop',
    featured: true,
    rating: 4.5,
    numReviews: 25
  },
  {
    name: 'Premium A1 Ghee - 1kg',
    description: 'Pure and natural A1 ghee made from traditional methods. Rich in flavor and aroma, perfect for cooking and daily consumption.',
    category: 'a1',
    price: 850,
    stock: 75,
    weight: '1kg',
    image: 'https://images.unsplash.com/photo-1606914509763-623b1c80d2f3?w=400&h=400&fit=crop',
    featured: true,
    rating: 4.7,
    numReviews: 18
  },
  {
    name: 'Organic A2 Ghee - 500g',
    description: 'Organic A2 ghee sourced from grass-fed cows. Known for its health benefits and superior quality.',
    category: 'a2',
    price: 550,
    stock: 80,
    weight: '500g',
    image: 'https://images.unsplash.com/photo-1606914509763-623b1c80d2f3?w=400&h=400&fit=crop',
    featured: true,
    rating: 4.8,
    numReviews: 32
  },
  {
    name: 'Organic A2 Ghee - 1kg',
    description: 'Organic A2 ghee sourced from grass-fed cows. Known for its health benefits and superior quality.',
    category: 'a2',
    price: 1050,
    stock: 60,
    weight: '1kg',
    image: 'https://images.unsplash.com/photo-1606914509763-623b1c80d2f3?w=400&h=400&fit=crop',
    featured: true,
    rating: 4.9,
    numReviews: 28
  },
  {
    name: 'Traditional A1 Ghee - 250g',
    description: 'Traditional A1 ghee in convenient small pack. Perfect for trying out our premium quality.',
    category: 'a1',
    price: 250,
    stock: 120,
    weight: '250g',
    image: 'https://images.unsplash.com/photo-1606914509763-623b1c80d2f3?w=400&h=400&fit=crop',
    featured: false,
    rating: 4.3,
    numReviews: 15
  },
  {
    name: 'Premium A2 Ghee - 250g',
    description: 'Premium A2 ghee in convenient small pack. Experience the difference in quality.',
    category: 'a2',
    price: 300,
    stock: 90,
    weight: '250g',
    image: 'https://images.unsplash.com/photo-1606914509763-623b1c80d2f3?w=400&h=400&fit=crop',
    featured: false,
    rating: 4.6,
    numReviews: 20
  }
];

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ghee-ecommerce');
    console.log('Connected to MongoDB');

    await Product.deleteMany({});
    console.log('Cleared existing products');

    await Product.insertMany(products);
    console.log('Seeded products successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
};

seedProducts();
