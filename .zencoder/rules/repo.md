# Keeva Backend Repository Overview

## Tech Stack
- **Runtime**: Node.js (CommonJS modules)
- **Framework**: Express
- **Database**: MongoDB via Mongoose
- **Real-time Communication**: socket.io
- **Payment Gateway**: Razorpay
- **Other Services**: Twilio for SMS, Cloudinary for media storage

## Key Directories
- **controllers/**: Express route handlers for various domains (auth, orders, payments, partners, products, users).
- **routes/**: Express route definitions mapped to controllers.
- **services/**: Helper modules for orders, payments (including Razorpay integration), SMS, and order status utilities.
- **models/**: Mongoose schemas for core entities like User, Partner, Product, Order, and Otp.
- **middlewares/**: Authentication, partner authorization, and upload middleware.
- **utils/**: Utility helpers.
- **config/**: External service and database configuration (Cloudinary, MongoDB connection).

## Entry Point
- **app.js**: Sets up Express app, middleware, routes, socket.io integration, and server start logic.

## Notable Features
- User/Partner authentication and order management.
- Razorpay payment initiation via dedicated service/controller.
- Order status transitions handled through `services/orderStatus.js`.
- Socket.io available for real-time updates (needs integration per feature).