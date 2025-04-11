import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { AuthUser } from '../types/auth';
import { RequestHandler } from '../types/express';

interface JwtPayload {
  id: string;
  role: 'admin' | 'student';
}

export const authenticateToken: RequestHandler = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JwtPayload;

    // Set user with both id and _id properties
    const userId = decoded.id;
    req.user = {
      id: userId,
      _id: new Types.ObjectId(userId),
      role: decoded.role
    } as AuthUser;
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

export const isAdmin: RequestHandler = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin rights required.'
    });
  }
};

export const authorize = (...roles: Array<'admin' | 'student'>): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'User role not authorized to access this route'
      });
    }
    next();
  };
}; 