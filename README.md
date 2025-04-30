# Entrance Exam System - Backend

This is the backend service for the Entrance Exam System, built with Node.js, Express, and TypeScript.

## Features

- User authentication and authorization
- Exam management
- File upload handling
- Secure API endpoints
- MongoDB database integration

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=24h
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_admin_password
   FRONTEND_URL=http://localhost:5173
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment

This application is configured for deployment on Render. The `render.yaml` file contains the necessary configuration.

### Environment Variables

The following environment variables need to be set in the Render dashboard:

- `NODE_ENV`: Set to "production"
- `PORT`: Port number (default: 10000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: JWT token expiration time
- `ADMIN_USERNAME`: Admin account username
- `ADMIN_PASSWORD`: Admin account password
- `FRONTEND_URL`: URL of the frontend application

## API Documentation

API documentation is available at `/api-docs` when running the server.

## License

ISC
