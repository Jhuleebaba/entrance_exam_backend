import Redis from 'ioredis';
import logger from '../utils/logger';

class RedisService {
  private client: Redis | null = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;

  constructor() {
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      logger.info('Initializing Redis connection...', {
        hasRedisUrl: !!process.env.REDIS_URL,
        redisHost: process.env.REDIS_HOST || 'localhost',
        redisPort: process.env.REDIS_PORT || '6379'
      });

      // Determine if we should use SSL based on URL
      const redisUrl = process.env.REDIS_URL;
      const useSSL = redisUrl?.startsWith('rediss://');

      // Production-ready Redis options
      const baseOptions = {
        maxRetriesPerRequest: 3,
        connectTimeout: 60000, // 60 seconds
        commandTimeout: 10000,  // 10 seconds
        enableOfflineQueue: false,
        lazyConnect: false,
        keepAlive: 30000,
        family: 4,
        retryDelayOnFailover: 200,
      };

      // Add TLS for secure connections
      if (useSSL) {
        Object.assign(baseOptions, {
          tls: {
            rejectUnauthorized: false, // Render Redis requires this
          }
        });
      }

      // Create Redis client
      if (redisUrl) {
        logger.info('Connecting to Redis using URL', { useSSL });
        this.client = new Redis(redisUrl, baseOptions);
      } else {
        logger.info('Connecting to Redis using host/port');
        this.client = new Redis({
          ...baseOptions,
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        });
      }

      // Set up event handlers
      this.setupEventHandlers();

      // Test the connection
      await this.testConnection();
      
    } catch (error) {
      logger.error('Failed to initialize Redis:', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: this.connectionAttempts + 1
      });
      this.client = null;
      this.isConnected = false;
      
      // Retry with exponential backoff
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        this.connectionAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);
        logger.info(`Retrying Redis connection in ${delay}ms...`);
        setTimeout(() => this.connect(), delay);
      } else {
        logger.error('Max Redis connection attempts reached. Operating without cache.');
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis connection established');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.connectionAttempts = 0; // Reset on successful connection
      logger.info('Redis is ready for commands');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis error:', { 
        error: error.message,
        code: (error as any).code 
      });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', (ms) => {
      logger.info(`Redis reconnecting in ${ms}ms`);
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.warn('Redis connection ended');
    });
  }

  private async testConnection(): Promise<void> {
    if (!this.client) return;
    
    try {
      const result = await this.client.ping();
      if (result === 'PONG') {
        logger.info('Redis connection test successful');
      } else {
        throw new Error('Invalid ping response: ' + result);
      }
    } catch (error) {
      logger.error('Redis connection test failed:', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) {
      logger.debug('Redis not available for GET operation');
      return null;
    }

    try {
      const result = await this.client.get(key);
      logger.debug(result ? 'Cache hit' : 'Cache miss', { key });
      return result;
    } catch (error) {
      logger.error('Redis GET error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.debug('Redis not available for SET operation');
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      logger.debug('Cache set successful', { key, ttl: ttlSeconds });
      return true;
    } catch (error) {
      logger.error('Redis SET error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.del(key);
      logger.debug('Cache delete', { key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Redis DELETE error:', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info('Cache pattern invalidated', { pattern, keysCount: keys.length });
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
      logger.error('Redis EXISTS error:', { 
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
      logger.error('Redis STATS error:', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
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
      try {
        await this.client.disconnect();
        logger.info('Redis disconnected gracefully');
      } catch (error) {
        logger.error('Error during Redis disconnect:', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();
export default redisService; 