# Ghee E-Commerce Application

A full-stack MERN (MongoDB, Express, React, Node.js) e-commerce application specializing in premium ghee products with two categories: A1 and A2.

## Features

- 🛍️ **Product Catalog**: Browse ghee products filtered by categories (A1, A2)
- 🔍 **Search Functionality**: Search products by name or description
- 🛒 **Shopping Cart**: Add, update, and remove items from cart
- 👤 **User Authentication**: Register, login, and user profile management
- 📦 **Order Management**: Place orders and track order history
- 💳 **Checkout**: Complete checkout process with shipping address
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS

## Tech Stack

### Backend
- Node.js & Express.js
- MongoDB & Mongoose
- JWT Authentication
- bcryptjs for password hashing

### Frontend
- React 18
- React Router DOM
- Tailwind CSS
- Axios for API calls
- Vite for build tooling

## Project Structure

```
ghee-ecommerce/
├── backend/
│   ├── models/          # MongoDB models (Product, User, Cart, Order)
│   ├── routes/          # API routes
│   ├── middleware/      # Authentication middleware
│   ├── server.js        # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── context/     # React context (Auth)
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ghee-ecommerce
JWT_SECRET=your_jwt_secret_key_change_in_production
NODE_ENV=development
```

4. Start MongoDB (if running locally):
```bash
# Windows
mongod

# macOS/Linux
sudo systemctl start mongod
```

5. Start the backend server:
```bash
npm run dev
```

The backend server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Products
- `GET /api/products` - Get all products (with optional query params: category, featured, search)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin only)
- `PUT /api/products/:id` - Update product (Admin only)
- `DELETE /api/products/:id` - Delete product (Admin only)

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:itemId` - Update cart item quantity
- `DELETE /api/cart/items/:itemId` - Remove item from cart
- `DELETE /api/cart` - Clear cart

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/myorders` - Get user's orders
- `GET /api/orders/:id` - Get single order

## Sample Data

To add sample products, you can use MongoDB Compass or create a script. Example product structure:

```json
{
  "name": "Premium A1 Ghee",
  "description": "Pure and natural A1 ghee made from traditional methods",
  "category": "a1",
  "price": 450,
  "stock": 100,
  "weight": "500g",
  "image": "https://via.placeholder.com/400x400?text=A1+Ghee",
  "featured": true
}
```

## Usage

1. Start both backend and frontend servers
2. Open `http://localhost:3000` in your browser
3. Register a new account or login
4. Browse products by category (A1 or A2)
5. Add products to cart
6. Proceed to checkout
7. Place your order

## Environment Variables

### Backend (.env)
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `NODE_ENV` - Environment (development/production)

## Production Deployment

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Set production environment variables
3. Use a process manager like PM2 for Node.js
4. Configure MongoDB Atlas for cloud database
5. Set up reverse proxy (nginx) if needed

## License

This project is open source and available for educational purposes.

## Support

For issues or questions, please create an issue in the repository.
