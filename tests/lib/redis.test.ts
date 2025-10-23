import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock redis
const mockRedisClient = {
  connect: vi.fn(),
  get: vi.fn(),
  setEx: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
  on: vi.fn()
};

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient)
}));

// Mock config
const mockGetConfig = vi.fn();
vi.mock('../../src/lib/config', () => ({
  getConfig: mockGetConfig
}));

// Mock logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Redis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mocks
    mockRedisClient.connect.mockClear();
    mockRedisClient.get.mockClear();
    mockRedisClient.setEx.mockClear();
    mockRedisClient.del.mockClear();
    mockRedisClient.quit.mockClear();
    mockRedisClient.on.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Memory Cache Fallback', () => {
    it('should store and retrieve from memory cache when Redis fails', async () => {
      // Mock config to return Redis URL but connection fails
      mockGetConfig.mockReturnValue({
        nodeEnv: 'development',
        isDevelopment: true,
        isProduction: false,
        appUrl: 'http://localhost:3000',
        redisUrl: 'redis://localhost:6379'
      });
      
      // Mock Redis connection failure
      mockRedisClient.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Clear module cache and import fresh
      vi.resetModules();
      const { redisService } = await import('../../src/lib/redis');
      
      // Test memory cache functionality
      await redisService.set('memory-key', 'memory-value', 60);
      const value = await redisService.get('memory-key');
      
      expect(value).toBe('memory-value');
      expect(redisService.isConnected()).toBe(false);
    });

    it('should handle Redis failures and fallback to memory', async () => {
      // Mock config to return Redis URL
      mockGetConfig.mockReturnValue({
        nodeEnv: 'development',
        isDevelopment: true,
        isProduction: false,
        appUrl: 'http://localhost:3000',
        redisUrl: 'redis://localhost:6379'
      });
      
      // Mock Redis connection success but SET fails
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      mockRedisClient.setEx.mockRejectedValueOnce(new Error('SET failed'));
      
      // Clear module cache and import fresh
      vi.resetModules();
      const { redisService } = await import('../../src/lib/redis');
      
      await redisService.set('fallback-key', 'fallback-value', 60);
      const value = await redisService.get('fallback-key');
      
      expect(value).toBe('fallback-value');
    });

    it('should respect TTL in memory cache', async () => {
      // Mock config to return Redis URL but connection fails
      mockGetConfig.mockReturnValue({
        nodeEnv: 'development',
        isDevelopment: true,
        isProduction: false,
        appUrl: 'http://localhost:3000',
        redisUrl: 'redis://localhost:6379'
      });
      
      mockRedisClient.connect.mockRejectedValueOnce(new Error('No Redis'));
      
      // Clear module cache and import fresh
      vi.resetModules();
      const { redisService } = await import('../../src/lib/redis');
      
      // Store with 1 second expiry
      await redisService.set('expiry-key', 'expiry-value', 1);
      
      // Should exist immediately
      let value = await redisService.get('expiry-key');
      expect(value).toBe('expiry-value');
      
      // Wait 1.1 seconds
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      value = await redisService.get('expiry-key');
      expect(value).toBeNull();
    });

    it('should delete from memory cache', async () => {
      // Mock config to return Redis URL but connection fails
      mockGetConfig.mockReturnValue({
        nodeEnv: 'development',
        isDevelopment: true,
        isProduction: false,
        appUrl: 'http://localhost:3000',
        redisUrl: 'redis://localhost:6379'
      });
      
      mockRedisClient.connect.mockRejectedValueOnce(new Error('No Redis'));
      
      // Clear module cache and import fresh
      vi.resetModules();
      const { redisService } = await import('../../src/lib/redis');
      
      await redisService.set('memory-delete-key', 'value', 60);
      await redisService.delete('memory-delete-key');
      
      const value = await redisService.get('memory-delete-key');
      expect(value).toBeNull();
    });
  });

  describe('Redis Operations', () => {
    it('should store and retrieve values from Redis when connected', async () => {
      // Mock config to return Redis URL
      mockGetConfig.mockReturnValue({
        nodeEnv: 'development',
        isDevelopment: true,
        isProduction: false,
        appUrl: 'http://localhost:3000',
        redisUrl: 'redis://localhost:6379'
      });
      
      // Mock successful Redis operations
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      mockRedisClient.setEx.mockResolvedValueOnce('OK');
      mockRedisClient.get.mockResolvedValueOnce('test-value');
      
      // Clear module cache and import fresh
      vi.resetModules();
      const { redisService } = await import('../../src/lib/redis');
      
      await redisService.set('test-key', 'test-value', 60);
      const value = await redisService.get('test-key');
      
      expect(value).toBe('test-value');
      expect(mockRedisClient.setEx).toHaveBeenCalledWith('test-key', 60, 'test-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should delete from Redis when connected', async () => {
      // Mock config to return Redis URL
      mockGetConfig.mockReturnValue({
        nodeEnv: 'development',
        isDevelopment: true,
        isProduction: false,
        appUrl: 'http://localhost:3000',
        redisUrl: 'redis://localhost:6379'
      });
      
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      mockRedisClient.del.mockResolvedValueOnce(1);
      
      // Clear module cache and import fresh
      vi.resetModules();
      const { redisService } = await import('../../src/lib/redis');
      
      await redisService.delete('delete-key');
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('delete-key');
    });
  });

  describe('Connection Status', () => {
    it('should return connection status', async () => {
      // Mock config to return Redis URL
      mockGetConfig.mockReturnValue({
        nodeEnv: 'development',
        isDevelopment: true,
        isProduction: false,
        appUrl: 'http://localhost:3000',
        redisUrl: 'redis://localhost:6379'
      });
      
      // Clear module cache and import fresh
      vi.resetModules();
      const { isRedisConnected } = await import('../../src/lib/redis');
      
      const connected = isRedisConnected();
      expect(typeof connected).toBe('boolean');
    });
  });
});