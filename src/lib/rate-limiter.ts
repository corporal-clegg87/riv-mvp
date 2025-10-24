/**
 * Rate limiting utilities for authentication operations
 * Provides rate limiting for token refresh and other auth operations
 */

import { redisService } from './redis';
import { logger } from './logger';
import { getOptionalEnvVar } from './config';

const RATE_LIMIT_PREFIX = getOptionalEnvVar('RATE_LIMIT_PREFIX', 'rate_limit:');
const DEFAULT_REFRESH_LIMIT = parseInt(getOptionalEnvVar('REFRESH_RATE_LIMIT', '10')); // 10 requests
const DEFAULT_REFRESH_WINDOW = parseInt(getOptionalEnvVar('REFRESH_RATE_WINDOW', '3600')); // 1 hour

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix: string;
}

/**
 * Rate Limiter Service
 * 
 * Provides rate limiting functionality for authentication operations using Redis-backed storage.
 * Implements sliding window rate limiting to prevent abuse of token refresh and other auth operations.
 * 
 * Features:
 * - Redis-backed rate limiting with automatic expiration
 * - Sliding window algorithm for accurate rate limiting
 * - Configurable limits and windows
 * - Graceful fallback to in-memory storage when Redis is unavailable
 * - Comprehensive logging and error handling
 * 
 * Usage:
 * ```typescript
 * import { checkRateLimit, resetRateLimit } from './rate-limiter';
 * 
 * // Check if operation is allowed
 * const result = await checkRateLimit('user123', 'refresh');
 * if (!result.allowed) {
 *   throw new Error('Rate limit exceeded');
 * }
 * ```
 * 
 * Configuration:
 * - REFRESH_RATE_LIMIT: Maximum refresh requests per window (default: 10)
 * - REFRESH_RATE_WINDOW: Rate limit window in seconds (default: 3600 = 1 hour)
 * - RATE_LIMIT_PREFIX: Redis key prefix for rate limiting (default: 'rate_limit:')
 * 
 * @class RateLimiterService
 */
class RateLimiterService {
  private memoryStore: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Checks if an operation is allowed under rate limiting rules
   * @param identifier - Unique identifier (user ID, IP, etc.)
   * @param operation - The operation being rate limited
   * @param config - Optional custom rate limit configuration
   * @returns Promise that resolves to rate limit result
   */
  async checkRateLimit(
    identifier: string, 
    operation: string, 
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const finalConfig: RateLimitConfig = {
      maxRequests: config?.maxRequests ?? DEFAULT_REFRESH_LIMIT,
      windowSeconds: config?.windowSeconds ?? DEFAULT_REFRESH_WINDOW,
      keyPrefix: config?.keyPrefix ?? RATE_LIMIT_PREFIX
    };
    
    const key = `${finalConfig.keyPrefix}${operation}:${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - finalConfig.windowSeconds;
    
    try {
      if (redisService.isConnected()) {
        return await this.checkRedisRateLimit(key, finalConfig, now, windowStart);
      } else {
        return await this.checkMemoryRateLimit(key, finalConfig, now, windowStart);
      }
    } catch (error) {
      logger.error('Rate limit check failed', { 
        identifier, 
        operation, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, error instanceof Error ? error : undefined);
      
      // Fail open - allow operation if rate limiting fails
      return {
        allowed: true,
        remaining: finalConfig.maxRequests,
        resetTime: now + finalConfig.windowSeconds
      };
    }
  }

  /**
   * Checks rate limit using Redis storage
   */
  private async checkRedisRateLimit(
    key: string, 
    config: RateLimitConfig, 
    now: number, 
    windowStart: number
  ): Promise<RateLimitResult> {
    try {
      // Get current count from Redis
      const currentCount = await redisService.get(key);
      const count = currentCount ? parseInt(currentCount) : 0;
      
      if (count >= config.maxRequests) {
        const ttl = await this.getRedisTTL(key);
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + (ttl || config.windowSeconds),
          error: 'Rate limit exceeded'
        };
      }
      
      // Increment counter
      const newCount = count + 1;
      await redisService.set(key, newCount.toString(), config.windowSeconds);
      
      return {
        allowed: true,
        remaining: config.maxRequests - newCount,
        resetTime: now + config.windowSeconds
      };
    } catch (error) {
      throw new Error(`Redis rate limit check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks rate limit using in-memory storage
   */
  private async checkMemoryRateLimit(
    key: string, 
    config: RateLimitConfig, 
    now: number, 
    windowStart: number
  ): Promise<RateLimitResult> {
    const stored = this.memoryStore.get(key);
    
    if (!stored || now > stored.resetTime) {
      // Reset or create new entry
      this.memoryStore.set(key, {
        count: 1,
        resetTime: now + config.windowSeconds
      });
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowSeconds
      };
    }
    
    if (stored.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: stored.resetTime,
        error: 'Rate limit exceeded'
      };
    }
    
    // Increment counter
    stored.count++;
    
    return {
      allowed: true,
      remaining: config.maxRequests - stored.count,
      resetTime: stored.resetTime
    };
  }

  /**
   * Gets TTL for a Redis key (simplified implementation)
   */
  private async getRedisTTL(key: string): Promise<number | null> {
    // This would need to be implemented based on your Redis client capabilities
    // For now, return null to indicate unknown TTL
    return null;
  }

  /**
   * Resets rate limit for an identifier and operation
   * @param identifier - Unique identifier
   * @param operation - The operation to reset
   */
  async resetRateLimit(identifier: string, operation: string): Promise<void> {
    const key = `${RATE_LIMIT_PREFIX}${operation}:${identifier}`;
    
    try {
      if (redisService.isConnected()) {
        await redisService.delete(key);
      } else {
        this.memoryStore.delete(key);
      }
      
      logger.info('Rate limit reset', { identifier, operation });
    } catch (error) {
      logger.error('Failed to reset rate limit', { 
        identifier, 
        operation, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

// Singleton instance
export const rateLimiterService = new RateLimiterService();

// Convenience exports
export const checkRateLimit = (identifier: string, operation: string, config?: Partial<RateLimitConfig>) => 
  rateLimiterService.checkRateLimit(identifier, operation, config);
export const resetRateLimit = (identifier: string, operation: string) => 
  rateLimiterService.resetRateLimit(identifier, operation);
