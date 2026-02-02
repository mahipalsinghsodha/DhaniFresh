# Troubleshooting Guide

## 500 Internal Server Error - Registration Endpoint

### Common Causes and Solutions

#### 1. MongoDB Not Connected
**Symptom:** Registration fails with 500 error

**Solution:**
- Check if MongoDB is running (see MongoDB section below)
- Verify connection in backend console: Should see "MongoDB Connected Successfully"
- Test health endpoint: `http://localhost:5000/api/health`

#### 2. Missing Required Fields
**Symptom:** Validation errors

**Solution:**
- Ensure all fields are provided: name, email, password
- Password must be at least 6 characters
- Email must be valid format

#### 3. Duplicate Email
**Symptom:** "User already exists" error

**Solution:**
- Use a different email address
- Or login with existing account instead

#### 4. bcryptjs Installation Issue
**Symptom:** Error related to password hashing

**Solution:**
```bash
cd backend
npm install bcryptjs
```

## 500 Internal Server Error - Products Endpoint

### Common Causes and Solutions

#### 1. MongoDB Not Running
**Symptom:** Error fetching products, MongoDB connection error in console

**Solution:**
- **Windows:** Make sure MongoDB service is running
  ```bash
  # Check if MongoDB is running
  net start MongoDB
  
  # Or start MongoDB manually
  mongod
  ```

- **macOS/Linux:**
  ```bash
  sudo systemctl start mongod
  # or
  brew services start mongodb-community
  ```

- **Using MongoDB Atlas (Cloud):**
  - Update `.env` file with your Atlas connection string
  - Make sure your IP is whitelisted in Atlas

#### 2. MongoDB Connection String Issue
**Symptom:** Connection timeout or refused

**Solution:**
- Check your `.env` file in the backend directory
- Default: `mongodb://localhost:27017/ghee-ecommerce`
- For MongoDB Atlas, use: `mongodb+srv://username:password@cluster.mongodb.net/ghee-ecommerce`

#### 3. Database Not Created
**Symptom:** Connection successful but no products

**Solution:**
- Run the seed script to create sample products:
  ```bash
  cd backend
  npm run seed
  ```

#### 4. Port Already in Use
**Symptom:** Server won't start, port 5000 already in use

**Solution:**
- Change PORT in `.env` file
- Or kill the process using port 5000:
  ```bash
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  
  # macOS/Linux
  lsof -ti:5000 | xargs kill
  ```

### Debugging Steps

1. **Check MongoDB Connection:**
   ```bash
   # Test MongoDB connection
   mongosh
   # or
   mongo
   ```

2. **Check Backend Logs:**
   - Look for "MongoDB Connected Successfully" message
   - Check for any error messages in the console

3. **Test Health Endpoint:**
   ```bash
   curl http://localhost:5000/api/health
   ```
   Should return:
   ```json
   {
     "status": "OK",
     "mongodb": "Connected",
     "timestamp": "..."
   }
   ```

4. **Check Frontend Console:**
   - Open browser DevTools (F12)
   - Check Network tab for failed requests
   - Check Console for error messages

5. **Verify Environment Variables:**
   - Make sure `.env` file exists in backend directory
   - Check that MONGODB_URI is correct

### Quick Fix Checklist

- [ ] MongoDB is running
- [ ] Backend server is running (port 5000)
- [ ] Frontend server is running (port 3000)
- [ ] `.env` file exists with correct MONGODB_URI
- [ ] Dependencies installed (`npm install` in both backend and frontend)
- [ ] Sample data seeded (`npm run seed` in backend)

### Still Having Issues?

1. Check backend console for detailed error messages
2. Verify MongoDB connection string
3. Try restarting both backend and frontend servers
4. Clear browser cache and reload
5. Check if CORS is properly configured (should be fine with current setup)
