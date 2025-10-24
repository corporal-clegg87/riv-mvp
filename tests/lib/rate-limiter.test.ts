import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock redis service
const mockRedisService = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  isConnected: vi.fn(() => true)
}));

vi.mock('../../src/lib/redis', () => ({
  redisService: mockRedisService
}));

// Mock logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { checkRateLimit, resetRateLimit, rateLimiterService } from '../../src/lib/rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rate Limit Checking', () => {
    it('should allow requests within rate limit', async () => {
      mockRedisService.get.mockResolvedValueOnce('5'); // 5 requests made
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      const result = await checkRateLimit('user123', 'refresh');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 6
      expect(result.resetTime).toBeGreaterThan(Date.now() / 1000);
    });

    it('should block requests exceeding rate limit', async () => {
      mockRedisService.get.mockResolvedValueOnce('10'); // 10 requests made (at limit)
      
      const result = await checkRateLimit('user123', 'refresh');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle first request correctly', async () => {
      mockRedisService.get.mockResolvedValueOnce(null); // No previous requests
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      const result = await checkRateLimit('user123', 'refresh');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'rate_limit:refresh:user123',
        '1',
        3600 // 1 hour
      );
    });
  });

  describe('Custom Rate Limit Configuration', () => {
    it('should use custom rate limit configuration', async () => {
      mockRedisService.get.mockResolvedValueOnce('2');
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      const result = await checkRateLimit('user123', 'refresh', {
        maxRequests: 5,
        windowSeconds: 1800 // 30 minutes
      });
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // 5 - 3
    });
  });

  describe('Memory Fallback', () => {
    it('should use memory storage when Redis is unavailable', async () => {
      mockRedisService.isConnected.mockReturnValueOnce(false);
      
      const result = await checkRateLimit('user123', 'refresh');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should handle memory storage rate limiting', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      
      // First request
      const result1 = await checkRateLimit('user123', 'refresh');
      expect(result1.allowed).toBe(true);
      
      // Second request
      const result2 = await checkRateLimit('user123', 'refresh');
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Rate Limit Reset', () => {
    it('should reset rate limit for identifier and operation', async () => {
      mockRedisService.isConnected.mockReturnValueOnce(true);
      mockRedisService.delete.mockResolvedValueOnce(undefined);
      
      await resetRateLimit('user123', 'refresh');
      
      expect(mockRedisService.delete).toHaveBeenCalledWith('rate_limit:refresh:user123');
    });

    it('should handle reset errors gracefully', async () => {
      mockRedisService.delete.mockRejectedValueOnce(new Error('Delete failed'));
      
      // Should not throw error
      await expect(resetRateLimit('user123', 'refresh')).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should fail open when rate limiting fails', async () => {
      mockRedisService.isConnected.mockReturnValueOnce(true);
      mockRedisService.get.mockRejectedValueOnce(new Error('Redis error'));
      
      const result = await checkRateLimit('user123', 'refresh');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should handle Redis connection errors gracefully', async () => {
      mockRedisService.isConnected.mockReturnValueOnce(true);
      mockRedisService.get.mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await checkRateLimit('user123', 'refresh');
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should work with rateLimiterService singleton', async () => {
      mockRedisService.get.mockResolvedValueOnce('3');
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      const result = await rateLimiterService.checkRateLimit('user123', 'refresh');
      
      expect(result.allowed).toBe(true);
    });
  });
});
