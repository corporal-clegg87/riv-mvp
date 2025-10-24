/**
 * Redis connection management with in-memory fallback
 * Provides automatic degradation when Redis is unavailable
 */

import { createClient, RedisClientType } from 'redis';
import { getConfig } from './config';
import { logger } from './logger';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

class RedisService {
  private static instance: RedisService;
  private client: RedisClientType | null = null;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private isRedisAvailable: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializationPromise = this.initialize();
    this.startMemoryCacheCleanup();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private async initialize(): Promise<void> {
    const config = getConfig();
    
    if (!config.redisUrl) {
      logger.warn('Redis URL not configured, using in-memory fallback');
      this.isRedisAvailable = false;
      return;
    }

    try {
      this.client = createClient({ url: config.redisUrl });
      
      this.client.on('error', (err) => {
        logger.error('Redis client error', { error: err.message }, err);
        this.isRedisAvailable = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isRedisAvailable = true;
      });

      await this.client.connect();
      this.isRedisAvailable = true;
    } catch (error) {
      logger.warn('Failed to connect to Redis, using in-memory fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        redisUrl: config.redisUrl?.replace(/:[^:]*@/, ':***@') // Mask credentials
      });
      this.isRedisAvailable = false;
      this.client = null;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  public async get(key: string): Promise<string | null> {
    await this.ensureInitialized();

    if (this.isRedisAvailable && this.client) {
      try {
        return await this.client.get(key);
      } catch (error) {
        logger.error('Redis GET failed, falling back to memory', { key, error: error instanceof Error ? error.message : 'Unknown' });
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  public async set(key: string, value: string, expirySeconds: number): Promise<void> {
    await this.ensureInitialized();

    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.setEx(key, expirySeconds, value);
        return;
      } catch (error) {
        logger.error('Redis SET failed, falling back to memory', { key, error: error instanceof Error ? error.message : 'Unknown' });
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + (expirySeconds * 1000)
    });
  }

  public async delete(key: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.del(key);
      } catch (error) {
        logger.error('Redis DELETE failed', { key, error: error instanceof Error ? error.message : 'Unknown' });
      }
    }

    this.memoryCache.delete(key);
  }

  public async getTTL(key: string): Promise<number | null> {
    await this.ensureInitialized();

    if (this.isRedisAvailable && this.client) {
      try {
        const ttl = await this.client.ttl(key);
        return ttl > 0 ? ttl : null;
      } catch (error) {
        logger.error('Redis TTL failed, falling back to memory', { key, error: error instanceof Error ? error.message : 'Unknown' });
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    const remaining = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    return remaining > 0 ? remaining : null;
  }

  public async scanKeys(pattern: string): Promise<string[]> {
    await this.ensureInitialized();

    if (this.isRedisAvailable && this.client) {
      try {
        const keys: string[] = [];
        let cursor = 0;
        
        do {
          const result = await this.client.scan(cursor, {
            MATCH: pattern,
            COUNT: 100
          });
          cursor = result.cursor;
          keys.push(...result.keys);
        } while (cursor !== 0);
        
        return keys;
      } catch (error) {
        logger.error('Redis SCAN failed, falling back to memory', { pattern, error: error instanceof Error ? error.message : 'Unknown' });
        this.isRedisAvailable = false;
      }
    }

    // Fallback to memory cache - scan memory keys
    const keys: string[] = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        // Check if key is still valid (not expired)
        const entry = this.memoryCache.get(key);
        if (entry && Date.now() <= entry.expiresAt) {
          keys.push(key);
        }
      }
    }
    
    return keys;
  }

  public isConnected(): boolean {
    return this.isRedisAvailable;
  }

  private startMemoryCacheCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.expiresAt) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000); // Cleanup every 60 seconds
  }

  public async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.client) {
      await this.client.quit();
    }
  }

  public cleanup(): void {
    this.memoryCache.clear();
  }
}

// Singleton instance
export const redisService = RedisService.getInstance();

// Convenience functions
export async function getRedisClient(): Promise<RedisService> {
  return redisService;
}

export function isRedisConnected(): boolean {
  return redisService.isConnected();
}
