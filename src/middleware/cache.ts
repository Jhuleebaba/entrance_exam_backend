import { Request, Response, NextFunction } from 'express';
import redisService from '../services/redisService';
import logger from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  skipCache?: boolean;
  varyBy?: string[]; // Fields to include in cache key (e.g., ['userId', 'subject'])
}

// Cache middleware factory
export const cacheMiddleware = (options: CacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const {
      ttl = 300, // 5 minutes default
      keyPrefix = 'api',
      skipCache = false,
      varyBy = []
    } = options;

    if (skipCache || !redisService.isReady()) {
      return next();
    }

    // Generate cache key
    const cacheKey = generateCacheKey(req, keyPrefix, varyBy);
    
    try {
      // Try to get cached response
      const cachedResponse = await redisService.getJSON(cacheKey);
      
      if (cachedResponse) {
        logger.debug('Cache hit for API response', { cacheKey });
        return res.json(cachedResponse);
      }

      // Cache miss - intercept response
      const originalJson = res.json;
      res.json = function(body: any) {
        // Cache successful responses only
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisService.cacheJSON(cacheKey, body, ttl).catch((error) => {
            logger.error('Failed to cache response', { cacheKey, error: error.message });
          });
        }
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', { 
        cacheKey, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      next();
    }
  };
};

// Generate cache key based on request
function generateCacheKey(req: Request, prefix: string, varyBy: string[]): string {
  const baseKey = `${prefix}:${req.method}:${req.path}`;
  
  const varyParts: string[] = [];
  
  // Add query parameters
  if (Object.keys(req.query).length > 0) {
    const sortedQuery = Object.keys(req.query)
      .sort()
      .map(key => `${key}=${req.query[key]}`)
      .join('&');
    varyParts.push(`query:${sortedQuery}`);
  }
  
  // Add specified fields to vary by
  varyBy.forEach(field => {
    const value = getNestedValue(req, field);
    if (value !== undefined) {
      varyParts.push(`${field}:${value}`);
    }
  });
  
  return varyParts.length > 0 
    ? `${baseKey}:${varyParts.join(':')}`
    : baseKey;
}

// Helper to get nested values from request object
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Cache invalidation helpers
export const invalidateCache = {
  // Invalidate by pattern
  pattern: async (pattern: string): Promise<void> => {
    await redisService.invalidatePattern(pattern);
  },
  
  // Invalidate exam-related caches
  examData: async (): Promise<void> => {
    await Promise.all([
      redisService.invalidatePattern('api:*exam*'),
      redisService.invalidatePattern('questions:*'),
      redisService.invalidatePattern('settings:*')
    ]);
  },
  
  // Invalidate questions by subject
  questionsBySubject: async (subject: string): Promise<void> => {
    await redisService.invalidatePattern(`questions:${subject}:*`);
  },
  
  // Invalidate user-specific caches
  userCache: async (userId: string): Promise<void> => {
    await redisService.invalidatePattern(`*user.id:${userId}*`);
  }
};

// Specific cache functions for common operations
export const cacheKeys = {
  examSettings: () => 'settings:exam',
  questionsBySubject: (subject: string, count: number) => `questions:${subject}:${count}`,
  userExamStatus: (userId: string) => `exam:status:${userId}`,
  dashboardStats: () => 'stats:dashboard'
};

// Cache decorators for service functions
export const withCache = <T extends any[], R>(
  cacheKey: string,
  ttl: number,
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    // Try cache first
    const cached = await redisService.getJSON<R>(cacheKey);
    if (cached !== null) {
      logger.debug('Service cache hit', { cacheKey });
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn(...args);
    await redisService.cacheJSON(cacheKey, result, ttl);
    logger.debug('Service cache set', { cacheKey, ttl });
    
    return result;
  };
}; 