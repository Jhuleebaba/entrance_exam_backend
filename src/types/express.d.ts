import { Request, Response, NextFunction } from 'express';
import { AuthUser } from './auth';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export type RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response> | void | Response;

export type AuthRequestHandler = (
  req: Request & { user?: AuthUser },
  res: Response,
  next: NextFunction
) => Promise<void | Response> | void | Response; 