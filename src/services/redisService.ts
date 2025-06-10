import Redis from 'ioredis';
import logger from '../utils/logger';

class RedisService {
  private client: Redis | null = null;
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      // Redis connection options
      const redisOptions = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        lazyConnect: true,
      };

      // Add URL-based connection for cloud Redis providers
      if (process.env.REDIS_URL) {
        this.client = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          lazyConnect: true,
        });
      } else {
        this.client = new Redis(redisOptions);
      }

      // Event handlers
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected successfully');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis connection error:', { error: error.message });
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      // Test connection
      await this.client.connect();
      
    } catch (error) {
      logger.error('Failed to initialize Redis:', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      this.client = null;
      this.isConnected = false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not available, skipping cache get');
      return null;
    }

    try {
      const result = await this.client.get(key);
      if (result) {
        logger.debug('Cache hit', { key });
      } else {
        logger.debug('Cache miss', { key });
      }
      return result;
    } catch (error) {
      logger.error('Redis get error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not available, skipping cache set');
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      logger.debug('Cache set', { key, ttl: ttlSeconds });
      return true;
    } catch (error) {
      logger.error('Redis set error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not available, skipping cache delete');
      return false;
    }

    try {
      const result = await this.client.del(key);
      logger.debug('Cache delete', { key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Redis delete error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not available, skipping pattern invalidation');
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info('Invalidated cache pattern', { pattern, keysCount: keys.length });
      }
      return true;
    } catch (error) {
      logger.error('Redis pattern invalidation error:', { 
        pattern, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async getStats(): Promise<{ connected: boolean; keyCount?: number }> {
    if (!this.client || !this.isConnected) {
      return { connected: false };
    }

    try {
      const keyCount = await this.client.dbsize();
      return { connected: true, keyCount };
    } catch (error) {
      return { connected: false };
    }
  }

  // Cache helpers for common operations
  async cacheJSON(key: string, data: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(data);
      return await this.set(key, jsonString, ttlSeconds);
    } catch (error) {
      logger.error('JSON cache error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const jsonString = await this.get(key);
      if (!jsonString) return null;
      return JSON.parse(jsonString) as T;
    } catch (error) {
      logger.error('JSON parse error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();
export default redisService; 