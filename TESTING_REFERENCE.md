# Quick Testing Reference

## Backend Status Check
```bash
curl http://localhost:5000/
# Expected: "API is running"
```

## Test Registration - SUCCESS
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo User",
    "email": "demo@example.com",
    "password": "password123",
    "role": "customer"
  }'
```

**Expected Response (201)**:
```json
{
  "message": "User registered",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Demo User",
    "email": "demo@example.com",
    "role": "customer"
  }
}
```

---

## Test Registration - PASSWORD TOO SHORT (6 chars)
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo User",
    "email": "short@example.com",
    "password": "12345",
    "role": "customer"
  }'
```

**Expected Response (400)**:
```json
{
  "error": "Password must be at least 8 characters"
}
```

---

## Test Registration - MISSING FIELDS
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo User",
    "role": "customer"
  }'
```

**Expected Response (400)**:
```json
{
  "error": "All fields are required"
}
```

---

## Test Registration - INVALID EMAIL
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo User",
    "email": "invalid-email",
    "password": "password123",
    "role": "customer"
  }'
```

**Expected Response (400)**:
```json
{
  "error": "Invalid email format"
}
```

---

## Test Registration - DUPLICATE EMAIL (Second registration with same email)
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Another User",
    "email": "demo@example.com",
    "password": "password123",
    "role": "customer"
  }'
```

**Expected Response (409)**:
```json
{
  "error": "Email already registered"
}
```

---

## Test Login - SUCCESS
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "password123"
  }'
```

**Expected Response (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE2NDgyNjMzMzMsImV4cCI6MTY0ODg2ODEzM30...",
  "role": "customer",
  "name": "Demo User",
  "hasProfile": false,
  "workerProfileId": null
}
```

---

## Test Login - INVALID PASSWORD
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "wrongpassword"
  }'
```

**Expected Response (400)**:
```json
{
  "error": "Invalid credentials"
}
```

---

## Test Login - MISSING CREDENTIALS
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com"
  }'
```

**Expected Response (400)**:
```json
{
  "error": "Email and password are required"
}
```

---

## Using Token for Protected Endpoint (/me)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <TOKEN_FROM_LOGIN>"
```

**Expected Response (200)**:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Demo User",
  "email": "demo@example.com",
  "role": "customer"
}
```

---

## Environment Setup Verification

### Check Backend Configuration
```bash
# From backend directory
cat .env
```

Required variables:
- `MONGO_URI=mongodb://127.0.0.1:27017/DevOps_Review`
- `PORT=5000`
- `JWT_SECRET=replace_with_a_long_random_secret`
- `CLIENT_URL=http://localhost:5173`

### Check Frontend Configuration
```bash
# From frontend directory, api.js should have:
# baseURL: "http://localhost:5000/api"
```

---

## Backend Console Logs to Expect

### Successful Registration:
```
[REGISTER] Incoming request body: { name: 'Demo User', email: 'demo@example.com', password: '***', role: 'customer' }
[REGISTER] After sanitization: { name: 'Demo User', email: 'demo@example.com', role: 'customer', passwordLength: 11 }
[REGISTER] All validations passed, creating user
[REGISTER] User created successfully: 507f1f77bcf86cd799439011
```

### Successful Login:
```
[LOGIN] Incoming request: { email: 'demo@example.com' }
[LOGIN] Looking up user with email: demo@example.com
[LOGIN] Password verified, clearing failure state
[LOGIN] Generating JWT token
[LOGIN] Login successful for user: 507f1f77bcf86cd799439011
```

### Password Validation Failure:
```
[REGISTER] Incoming request body: { name: 'Demo', email: 'demo@ex.com', password: '***', role: 'customer' }
[REGISTER] After sanitization: { name: 'Demo', email: 'demo@ex.com', role: 'customer', passwordLength: 6 }
[REGISTER] Validation failed - password too short
```

---

## Frontend Console Logs in Browser DevTools

### Successful Registration:
```
[REGISTER] Submitting form: { name: 'Demo User', email: 'demo@example.com', role: 'customer' }
[REGISTER] Registration successful: { message: 'User registered', user: {...} }
```

### Error During Registration:
```
[REGISTER] Submitting form: { name: 'Demo', email: 'short@ex.com', role: 'customer' }
[REGISTER] Error: { status: 400, message: 'Password must be at least 8 characters', fullError: {...} }
```

---

## Test Sequence

Run this sequence to fully test the flow:

1. ✅ Register new user (check for [REGISTER] logs)
2. ✅ Try register duplicate email (should get 409)
3. ✅ Try register with short password (should get 400)
4. ✅ Login with correct password (should get token)
5. ✅ Try login with wrong password (should get 400)
6. ✅ Use token to access /me endpoint (should get user data)

---

## Quick Node.js Test Script

```javascript
// test-registration.js
const axios = require("axios");

const test = async () => {
  try {
    const email = "test" + Date.now() + "@example.com";

    // Register
    const regRes = await axios.post("http://localhost:5000/api/auth/register", {
      name: "Test User",
      email: email,
      password: "password123",
      role: "customer"
    });
    console.log("✓ Registration:", regRes.data.message);

    // Login
    const logRes = await axios.post("http://localhost:5000/api/auth/login", {
      email: email,
      password: "password123"
    });
    console.log("✓ Login: Token received");

    // Get user info
    const meRes = await axios.get("http://localhost:5000/api/auth/me", {
      headers: { Authorization: `Bearer ${logRes.data.token}` }
    });
    console.log("✓ User info:", meRes.data.name);

  } catch (error) {
    console.error("✗ Error:", error.response?.data?.error || error.message);
  }
};

test();
```

Run with: `node test-registration.js`

