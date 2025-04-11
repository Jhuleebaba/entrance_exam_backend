import { Request } from 'express';
import { Types } from 'mongoose';

export interface AuthUser {
  id: string;
  _id: Types.ObjectId;
  role: 'admin' | 'student';
}

export interface AuthRequest extends Request {
  user?: AuthUser;
} 