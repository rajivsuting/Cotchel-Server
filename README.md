# Cotchel Server - E-commerce Backend API

A secure, production-ready Node.js/Express.js backend for the Cotchel e-commerce platform with enterprise-grade security features.

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Cotchel_Server

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm start

# Test security features
npm run test:quick
npm run test:security
npm run test:csrf
```

## 🛡️ Security Features

### Implemented Security Measures

- ✅ **CSRF Protection** - All POST/PUT/DELETE requests protected
- ✅ **Security Headers** - Helmet.js with comprehensive CSP
- ✅ **Rate Limiting** - DDoS and brute force protection
- ✅ **Input Validation** - Joi schema validation
- ✅ **Authentication** - JWT-based with secure cookies
- ✅ **CORS Protection** - Configurable origin restrictions
- ✅ **Health Monitoring** - Real-time server status
- ✅ **Structured Logging** - Comprehensive logging system
- ✅ **Error Tracking** - Production-ready error handling
- ✅ **Performance Monitoring** - Real-time performance metrics

### Security Testing

```bash
# Quick security check
npm run test:quick

# Comprehensive security audit
npm run test:security

# CSRF protection test
npm run test:csrf
```

## 📊 Database Models

### User

**Description:** Represents a user (buyer, seller, or admin) in the system.

| Field                       | Type                     | Required | Description/Notes                             |
| --------------------------- | ------------------------ | -------- | --------------------------------------------- |
| fullName                    | String                   | No       | User's full name                              |
| email                       | String                   | Yes      | Unique, validated email address               |
| password                    | String                   | No       | Hashed password                               |
| phoneNumber                 | String                   | No       | Validated Indian phone number                 |
| dateOfBirth                 | Date                     | No       | Must be in the past                           |
| gender                      | String (enum)            | No       | 'Male', 'Female', 'Other'                     |
| role                        | String (enum)            | No       | 'Buyer', 'Seller', 'Admin' (default: 'Buyer') |
| lastActiveRole              | String (enum)            | No       | 'Buyer', 'Seller' (default: 'Buyer')          |
| isEmailVerified             | Boolean                  | No       | Email verification status                     |
| emailVerificationCode       | String                   | No       | For email verification                        |
| resetToken                  | String                   | No       | For password reset                            |
| tokenExpiry                 | Date                     | No       | Expiry for reset token                        |
| emailVerificationCodeExpiry | Date                     | No       | Expiry for email verification code            |
| isVerifiedSeller            | Boolean                  | No       | Seller verification status                    |
| sellerDetails               | ObjectId (SellerDetails) | No       | Reference to seller details                   |
| active                      | Boolean                  | No       | Account active status                         |
| addresses                   | [ObjectId] (Address)     | No       | References to user addresses                  |
| timestamps                  | Auto                     | -        | createdAt, updatedAt                          |

### Product

**Description:** Represents a product listed for sale.

| Field             | Type                   | Required | Description/Notes                    |
| ----------------- | ---------------------- | -------- | ------------------------------------ |
| title             | String                 | Yes      | Product title (max 255 chars)        |
| description       | String                 | No       | Product description (max 5000 chars) |
| images            | [String]               | No       | Array of image URLs (max 10)         |
| featuredImage     | String                 | Yes      | Main image URL                       |
| category          | ObjectId (Category)    | Yes      | Reference to category                |
| subCategory       | ObjectId (SubCategory) | Yes      | Reference to subcategory             |
| quantityAvailable | Number                 | Yes      | Stock quantity                       |
| price             | Number                 | Yes      | Sale price                           |
| compareAtPrice    | Number                 | No       | Original price (for discount)        |
| keyHighLights     | [String]               | No       | Key highlights (max 10)              |
| brand             | String                 | Yes      | Brand name                           |
| model             | String                 | Yes      | Model name                           |
| user              | ObjectId (User)        | No       | Seller reference                     |
| isActive          | Boolean                | No       | Product active status                |
| reviews           | [ObjectId] (Review)    | No       | Array of review references           |
| ratings           | Number                 | No       | Average rating (0-5)                 |
| lotSize           | Number                 | No       | Lot size                             |
| reviewsCount      | Number                 | No       | Number of reviews                    |
| length            | Number                 | Yes      | Product length (cm)                  |
| breadth           | Number                 | Yes      | Product breadth (cm)                 |
| height            | Number                 | Yes      | Product height (cm)                  |
| weight            | Number                 | Yes      | Product weight (g)                   |
| sku               | String                 | Yes      | Unique SKU                           |
| fileAttachments   | [String]               | No       | Array of file URLs (xls, pdf, etc.)  |
| timestamps        | Auto                   | -        | createdAt, updatedAt                 |

### Order

**Description:** Represents a placed order.

| Field                | Type             | Required | Description/Notes                     |
| -------------------- | ---------------- | -------- | ------------------------------------- |
| products             | Array of objects | Yes      | List of products, qty, price, isRated |
| buyer                | ObjectId (User)  | No       | Buyer reference                       |
| seller               | ObjectId (User)  | No       | Seller reference                      |
| totalPrice           | Number           | No       | Total order price                     |
| status               | String (enum)    | No       | Order status                          |
| paymentStatus        | String (enum)    | No       | Payment status                        |
| paymentTransactionId | String           | No       | Payment transaction ID                |
| address              | Object           | No       | Shipping address fields               |
| cartId               | ObjectId (Cart)  | No       | Reference to cart                     |
| statusHistory        | Array of objects | No       | Status change history                 |
| createdAt            | Date             | No       | Order creation date                   |

### Additional Models

- **Address** - User address information
- **SellerDetails** - Seller business and bank details
- **Category/SubCategory** - Product categorization
- **Cart** - Shopping cart
- **Review** - Product reviews
- **Wishlist** - User wishlists
- **Notification** - System notifications
- **Transaction** - Payment transactions
- **Banner** - Promotional banners

## 🔧 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Email verification
- `POST /api/auth/resend-otp` - Resend OTP
- `POST /api/auth/request-reset` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Products

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (requires CSRF token)
- `PUT /api/products/:id` - Update product (requires CSRF token)
- `DELETE /api/products/:id` - Delete product (requires CSRF token)

### Orders

- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create order (requires CSRF token)
- `PUT /api/orders/:id` - Update order status (requires CSRF token)

### Cart

- `GET /api/cart` - Get user cart
- `POST /api/cart` - Add to cart (requires CSRF token)
- `PUT /api/cart/:id` - Update cart item (requires CSRF token)
- `DELETE /api/cart/:id` - Remove from cart (requires CSRF token)

### Health & Monitoring

- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health check with all components
- `GET /api/health/database` - Database health check
- `GET /api/health/memory` - Memory usage health check
- `GET /api/health/system` - System information

### Monitoring & Metrics

- `GET /api/monitoring/metrics` - System metrics (CPU, memory, database)
- `GET /api/monitoring/performance` - Performance metrics
- `GET /api/monitoring/database/stats` - Database statistics
- `GET /api/monitoring/database/collections` - Collection statistics
- `GET /api/monitoring/alerts` - System alerts and warnings

## 🌐 Frontend Integration

### CSRF Token Integration

The server automatically provides CSRF tokens via cookies. Your frontend needs to include these tokens in requests.

#### JavaScript Implementation

```javascript
// Utility function to get CSRF token from cookies
function getCSRFToken() {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("XSRF-TOKEN="))
    ?.split("=")[1];
}

// Utility function to make API requests with CSRF token
async function apiRequest(url, options = {}) {
  const csrfToken = getCSRFToken();

  const defaultOptions = {
    credentials: "include", // Important for cookies
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken && { "X-CSRF-Token": csrfToken }),
      ...options.headers,
    },
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
  });

  if (
    response.status === 403 &&
    response.headers.get("content-type")?.includes("application/json")
  ) {
    const error = await response.json();
    if (error.error === "Invalid or missing CSRF token") {
      // Refresh the page to get a new CSRF token
      window.location.reload();
      return;
    }
  }

  return response;
}
```

#### Axios Implementation

```javascript
import axios from "axios";

// Create axios instance with CSRF token handling
const api = axios.create({
  baseURL: "https://your-api-domain.com/api",
  withCredentials: true, // Important for cookies
});

// Request interceptor to add CSRF token
api.interceptors.request.use((config) => {
  const csrfToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("XSRF-TOKEN="))
    ?.split("=")[1];

  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }

  return config;
});

// Response interceptor to handle CSRF errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === "Invalid or missing CSRF token"
    ) {
      // Refresh the page to get a new CSRF token
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Rate Limiting Handling

```javascript
// Handle rate limiting errors
async function handleApiCall() {
  try {
    const response = await fetch("/api/endpoint");

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      console.log(`Rate limited. Retry after ${retryAfter} seconds`);

      // Show user-friendly message
      alert("Too many requests. Please wait a moment and try again.");
      return;
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
  }
}
```

### Error Handling

```javascript
// Handle different error types
async function handleApiError(response) {
  const error = await response.json();

  switch (response.status) {
    case 403:
      if (error.error === "Invalid or missing CSRF token") {
        // Refresh page to get new CSRF token
        window.location.reload();
      } else {
        alert("Access denied");
      }
      break;

    case 429:
      alert("Too many requests. Please wait and try again.");
      break;

    case 500:
      alert("Server error. Please try again later.");
      break;

    default:
      alert(error.message || "An error occurred");
  }
}
```

## 🚀 Deployment Guide

### Environment Variables Required

```bash
# Server Configuration
NODE_ENV=production
PORT=5000

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
REFRESH_SECRET=your-super-secure-refresh-secret-at-least-32-characters-long

# URLs (Update with your actual domains)
CLIENT_URL=https://your-frontend-domain.com
PRO_URL=https://your-production-domain.com
DEV_URL=http://localhost:5173

# Payment Gateway
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret

# Email Service
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# AWS S3 (if using file uploads)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=your-aws-region
S3_BUCKET_NAME=your-s3-bucket-name

# Google OAuth (if using)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Shipping (if using)
SHIPROCKET_EMAIL=your-shiprocket-email
SHIPROCKET_PASSWORD=your-shiprocket-password
SHIPROCKET_WEBHOOK_SECRET=your-shiprocket-webhook-secret
```

### Deployment Steps

1. **Environment Setup**

```bash
# Set NODE_ENV to production
export NODE_ENV=production

# Install dependencies
npm install --production

# Set up environment variables
cp .env.example .env
# Edit .env with your production values
```

2. **Database Setup**

```bash
# Ensure MongoDB is accessible
# Test database connection
npm run test:quick
```

3. **Security Testing**

```bash
# Test security features
npm run test:security

# Test CSRF protection
npm run test:csrf

# Quick health check
npm run test:quick
```

4. **Production Build**

```bash
# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start server.js --name "cotchel-server"
pm2 save
pm2 startup
```

### Post-Deployment Verification

#### API Endpoints Test

```bash
# Health check
curl https://your-domain.com/api/health

# Test CSRF protection
curl https://your-domain.com/api/test/test-csrf

# Test rate limiting
curl -I https://your-domain.com/api/health
```

#### Security Headers Verification

```bash
curl -I https://your-domain.com/api/health
```

Expected headers:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'`

#### Frontend Integration Test

1. **Login Flow**: Should work without CSRF token
2. **Protected Routes**: Should require CSRF token
3. **Error Handling**: Should handle 403 and 429 errors gracefully
4. **CORS**: Should allow requests from frontend domain

#### Performance Verification

```bash
# Test response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com/api/health

# Test under load
ab -n 1000 -c 10 https://your-domain.com/api/health
```

#### SSL/HTTPS Configuration

- [ ] SSL certificate installed
- [ ] HTTPS redirect configured
- [ ] HSTS headers working
- [ ] Mixed content issues resolved

#### Monitoring Setup

- [ ] Health check endpoint accessible
- [ ] Database connection monitoring
- [ ] Memory usage tracking
- [ ] Response time monitoring
- [ ] Error logs configured
- [ ] Access logs enabled
- [ ] Security event logging
- [ ] Rate limit violation logging

## 🧪 Testing

### Available Test Scripts

```bash
# Quick security test
npm run test:quick

# Comprehensive security audit
npm run test:security

# CSRF protection test
npm run test:csrf

# Monitoring and error handling test
npm run test:monitoring
```

### Manual Testing Commands

#### Test Security Headers

```bash
curl -I http://localhost:5000/api/health
```

**Expected Headers:**

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'`

#### Test CSRF Protection

```bash
# 1. GET request should work (no CSRF required)
curl http://localhost:5000/api/test/test-csrf

# 2. POST request without CSRF token should FAIL (403 error)
curl -X POST http://localhost:5000/api/test/test-csrf \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# 3. POST request with CSRF token should work
# First, get a session cookie (this will set the CSRF token)
curl -c cookies.txt http://localhost:5000/api/test/test-csrf

# Then use the cookie for the POST request
curl -X POST http://localhost:5000/api/test/test-csrf \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $(grep XSRF-TOKEN cookies.txt | cut -f7)" \
  -b cookies.txt \
  -d '{"test": "data"}'
```

#### Test Rate Limiting

```bash
# Make multiple requests to trigger rate limiting
for i in {1..110}; do
  echo "Request $i"
  curl -s http://localhost:5000/api/health | grep -o '"status":"[^"]*"'
done
```

**Expected Result:** After 100 requests, you should see 429 (Too Many Requests) errors.

#### Test Health Check

```bash
curl http://localhost:5000/api/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "database": {
    "status": "connected",
    "connectionState": 1
  },
  "memory": {
    "rss": 12345678,
    "heapTotal": 12345678,
    "heapUsed": 1234567,
    "external": 123456
  }
}
```

### Browser Testing

#### 1. Open Browser Developer Tools

- Press F12 or right-click → Inspect
- Go to Network tab

#### 2. Test CSRF Protection

```javascript
// In browser console
fetch("/api/test/test-csrf", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ test: "data" }),
})
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((error) => console.error("Error:", error));
```

**Expected Result:** 403 Forbidden error

#### 3. Test with CSRF Token

```javascript
// Get CSRF token from cookies
const csrfToken = document.cookie
  .split("; ")
  .find((row) => row.startsWith("XSRF-TOKEN="))
  ?.split("=")[1];

// Make request with CSRF token
fetch("/api/test/test-csrf", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
  },
  body: JSON.stringify({ test: "data" }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

**Expected Result:** Success response

### Visual Verification Checklist

#### ✅ Security Headers

- [ ] X-Frame-Options header present
- [ ] X-Content-Type-Options header present
- [ ] Strict-Transport-Security header present
- [ ] Content-Security-Policy header present

#### ✅ CSRF Protection

- [ ] GET requests work without CSRF token
- [ ] POST requests fail without CSRF token (403 error)
- [ ] POST requests work with valid CSRF token
- [ ] CSRF error messages are clear and helpful

#### ✅ Rate Limiting

- [ ] Normal requests work fine
- [ ] Excessive requests are blocked (429 error)
- [ ] Rate limit headers are present
- [ ] Rate limit resets after time window

#### ✅ Health Check

- [ ] Health endpoint responds with 200
- [ ] Database status is reported
- [ ] Memory usage is reported
- [ ] Uptime is reported

## 🔒 Security Configuration

### Implemented Security Features

#### 1. Helmet.js Security Headers

- **Content Security Policy (CSP)**: Prevents XSS attacks by controlling resource loading
- **HTTP Strict Transport Security (HSTS)**: Forces HTTPS connections
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer Policy**: Controls referrer information
- **Frame Options**: Prevents clickjacking attacks

#### 2. CSRF Protection

- **CSRF Tokens**: All POST/PUT/DELETE requests require valid CSRF tokens
- **Secure Cookies**: CSRF tokens stored in httpOnly cookies
- **Excluded Paths**: Webhooks and health checks are excluded from CSRF protection
- **Error Handling**: Proper error responses for invalid CSRF tokens

#### 3. Rate Limiting

- **Global Rate Limiting**: 100 requests per 15 minutes per IP (development)
- **Production Rate Limiting**: 1000 requests per 15 minutes per IP
- **Order-Specific Limiting**: 5 orders per 15 minutes per IP
- **Fraud Detection**: Advanced fraud detection for orders

### Production Settings

- **Rate Limiting**: 1000 requests per 15 minutes (vs 100 in development)
- **CSRF Protection**: Excludes authentication endpoints
- **Security Headers**: Optimized for production
- **CORS**: Configured for production domains

### Excluded from CSRF Protection

- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/verify-email`
- `/api/auth/resend-otp`
- `/api/auth/request-reset`
- `/api/auth/reset-password`
- `/api/razorpay/webhook`
- `/api/shiprocket/webhook`
- `/api/health`
- `/api/image/upload`
- `/api/image/upload-file`

### Security Best Practices

#### For Frontend Developers

1. Always include CSRF tokens in POST/PUT/DELETE requests
2. Use HTTPS in production
3. Validate all user inputs
4. Implement proper error handling
5. Set `credentials: 'include'` for all API calls

#### For Backend Developers

1. Keep dependencies updated
2. Monitor security logs
3. Use environment variables for sensitive data
4. Implement proper input validation
5. Regular security audits

### Monitoring and Logging

- All CSRF violations are logged
- Rate limiting violations are tracked
- Security headers are automatically applied
- Error responses don't expose sensitive information
- Health monitoring provides real-time status

### Security Testing Commands

```bash
# Test CSRF protection
curl -X POST http://localhost:5000/api/test/test-csrf \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Test rate limiting
for i in {1..110}; do
  curl -s http://localhost:5000/api/health
done

# Test security headers
curl -I http://localhost:5000/api/health
```

## 📊 Error Handling & Monitoring

### Enhanced Error Handling

#### Structured Error Responses

All errors now return structured responses with:

- **Request ID**: For tracking requests across logs
- **Timestamp**: When the error occurred
- **Error Type**: Specific error classification
- **Details**: Additional error information
- **Stack Trace**: In development mode only

#### Error Types Handled

- **Validation Errors**: Input validation failures
- **Cast Errors**: Invalid data type conversions
- **Duplicate Key Errors**: Database constraint violations
- **JWT Errors**: Authentication token issues
- **MongoDB Errors**: Database connection issues
- **Custom App Errors**: Application-specific errors

#### Error Tracking

- **Structured Logging**: All errors logged with context
- **Request Tracking**: Each request gets a unique ID
- **Performance Monitoring**: Slow requests are flagged
- **Security Events**: CSRF violations and rate limiting logged

### Comprehensive Logging System

#### Log Files

- **`logs/access.log`**: All HTTP requests and responses
- **`logs/error.log`**: Error events and stack traces
- **`logs/security.log`**: Security events (CSRF, rate limiting)
- **`logs/combined.log`**: All logs combined

#### Log Format

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "requestId": "abc123def456",
  "method": "GET",
  "url": "/api/health",
  "statusCode": 200,
  "duration": "15ms",
  "ip": "127.0.0.1",
  "userId": "user123"
}
```

#### Log Levels

- **Error**: Application errors and exceptions
- **Warn**: Security violations and warnings
- **Info**: Normal application flow
- **Debug**: Detailed debugging information

### Health Monitoring System

#### Health Check Endpoints

```bash
# Basic health check
curl http://localhost:5000/api/health

# Detailed health check
curl http://localhost:5000/api/health/detailed

# Database health
curl http://localhost:5000/api/health/database

# Memory usage
curl http://localhost:5000/api/health/memory

# System information
curl http://localhost:5000/api/health/system
```

#### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "responseTime": "15ms",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": "5ms",
      "connectionState": 1
    },
    "memory": {
      "status": "healthy",
      "usage": {
        "rss": 12345678,
        "heapTotal": 12345678,
        "heapUsed": 1234567
      },
      "percentage": 10
    },
    "system": {
      "status": "healthy",
      "uptime": "2h 30m 15s",
      "nodeVersion": "v18.17.0"
    }
  }
}
```

### Performance Monitoring

#### Real-time Metrics

- **Response Times**: Track API endpoint performance
- **Memory Usage**: Monitor heap and system memory
- **CPU Usage**: Track system load and process usage
- **Database Performance**: Query times and connection status
- **Slow Request Detection**: Automatic flagging of slow endpoints

#### Monitoring Endpoints

```bash
# System metrics
curl http://localhost:5000/api/monitoring/metrics

# Performance metrics
curl http://localhost:5000/api/monitoring/performance

# Database statistics
curl http://localhost:5000/api/monitoring/database/stats

# Collection statistics
curl http://localhost:5000/api/monitoring/database/collections

# System alerts
curl http://localhost:5000/api/monitoring/alerts
```

### Production Monitoring Setup

#### Environment Variables

```bash
# Logging configuration
LOG_LEVEL=info
NODE_ENV=production

# Monitoring thresholds
MEMORY_THRESHOLD=500MB
SLOW_REQUEST_THRESHOLD=1000ms
```

#### Monitoring Best Practices

1. **Set up log rotation**: Configure log files to rotate automatically
2. **Monitor disk space**: Ensure logs don't fill up disk
3. **Set up alerts**: Configure alerts for critical errors
4. **Regular health checks**: Monitor health endpoints
5. **Performance tracking**: Track response times and memory usage

#### Integration with External Services

The system is designed to integrate with:

- **Sentry**: Error tracking and monitoring
- **DataDog**: Application performance monitoring
- **New Relic**: Real-time monitoring
- **ELK Stack**: Log aggregation and analysis

## 📋 Production Checklist

### Pre-Deployment

- [x] Security features implemented
- [x] Rate limiting configured
- [x] CSRF protection active
- [x] Security headers configured
- [x] Health monitoring working

### Frontend Integration

- [ ] CSRF tokens included in all POST/PUT/DELETE requests
- [ ] `credentials: 'include'` set for all API calls
- [ ] Error handling for 403 CSRF errors
- [ ] Error handling for 429 rate limit errors
- [ ] Proper CORS configuration

### Deployment

- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Security features tested
- [ ] SSL certificate installed
- [ ] HTTPS redirect configured

### Post-Deployment

- [ ] All API endpoints responding
- [ ] Security features working
- [ ] Frontend integration successful
- [ ] No 500 errors in logs
- [ ] Health check passing

## 🛠️ Troubleshooting

### Common Issues

#### CSRF Token Errors

**Symptoms**: 403 errors on POST requests
**Solutions**:

- Check if frontend includes CSRF tokens
- Verify cookies are enabled
- Check CORS configuration
- Ensure `credentials: 'include'` is set in requests
- Check if CSRF token is being sent in `X-CSRF-Token` header

#### Rate Limiting Issues

**Symptoms**: 429 errors for normal users
**Solutions**:

- Increase rate limit if needed
- Check if behind proxy/load balancer
- Verify IP detection is working
- Check if `trust proxy` is set correctly
- Verify rate limiting middleware is applied

#### CORS Issues

**Symptoms**: Preflight failures
**Solutions**:

- Add domain to allowed origins
- Check HTTPS configuration
- Verify credentials setting
- Ensure proper CORS headers are set
- Check if frontend domain is in allowed origins

#### Database Connection Issues

**Symptoms**: Health check fails
**Solutions**:

- Check MongoDB connection string
- Verify network access
- Check database credentials
- Ensure MongoDB service is running
- Check firewall settings

#### Security Headers Issues

**Symptoms**: Headers not present in responses
**Solutions**:

- Verify Helmet.js is properly configured
- Check if any middleware is interfering
- Ensure proper CORS configuration
- Check if security middleware is applied in correct order

### Advanced Troubleshooting

#### CSRF Token Not Found

**Problem:** `XSRF-TOKEN` cookie not present
**Solution:**

- Check if cookies are enabled in browser
- Verify the server is setting cookies correctly
- Check CORS configuration for credentials
- Ensure session middleware is working

#### Rate Limiting Not Working

**Problem:** No requests are being blocked
**Solution:**

- Check if `trust proxy` is set correctly
- Verify rate limiting middleware is applied
- Check if you're behind a load balancer
- Ensure IP detection is working properly

#### Security Headers Missing

**Problem:** Security headers not appearing
**Solution:**

- Verify Helmet.js is properly configured
- Check if any middleware is interfering
- Ensure proper CORS configuration
- Check middleware order in server.js

### Debug Commands

#### Check Server Status

```bash
# Check if server is running
curl http://localhost:5000/api/health

# Check server logs
tail -f logs/app.log
```

#### Test CSRF Protection

```bash
# Test without CSRF token (should fail)
curl -X POST http://localhost:5000/api/test/test-csrf \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Test with CSRF token (should work)
curl -c cookies.txt http://localhost:5000/api/test/test-csrf
curl -X POST http://localhost:5000/api/test/test-csrf \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $(grep XSRF-TOKEN cookies.txt | cut -f7)" \
  -b cookies.txt \
  -d '{"test": "data"}'
```

#### Test Rate Limiting

```bash
# Make multiple requests to test rate limiting
for i in {1..110}; do
  echo "Request $i"
  curl -s http://localhost:5000/api/health | grep -o '"status":"[^"]*"'
done
```

#### Check Security Headers

```bash
curl -I http://localhost:5000/api/health
```

### Log Analysis

#### Common Log Patterns

- **CSRF Violations**: Look for "Invalid or missing CSRF token" messages
- **Rate Limiting**: Look for "Too many requests" messages
- **Database Issues**: Look for MongoDB connection errors
- **Security Headers**: Check if Helmet.js is logging any issues

#### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=* npm start
```

This will show detailed middleware and request information.

## 📚 API Documentation

For detailed API documentation, see the individual route files in the `routes/` directory.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:

- Check the troubleshooting section
- Review the security documentation
- Test with the provided test scripts
- Check server logs for detailed error messages
#   C o t c h e l - S e r v e r  
 