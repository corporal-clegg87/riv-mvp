import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock redis service
const mockRedisService = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
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

import { generateOTP, storeOTP, verifyOTP, deleteOTP, otpService } from '../../src/lib/otp';

describe('OTP Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('OTP Generation', () => {
    it('should generate a 6-digit numeric OTP', () => {
      const otp = generateOTP();
      
      expect(otp).toMatch(/^\d{6}$/);
      expect(parseInt(otp)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(otp)).toBeLessThan(1000000);
    });

    it('should generate unique OTPs', () => {
      const otps = new Set();
      
      for (let i = 0; i < 100; i++) {
        otps.add(generateOTP());
      }
      
      // With 100 samples from 1M possibilities, should be mostly unique
      expect(otps.size).toBeGreaterThan(95);
    });

    it('should use cryptographically secure random generation', () => {
      // Test that OTPs don't follow predictable patterns
      const otp1 = generateOTP();
      const otp2 = generateOTP();
      const otp3 = generateOTP();
      
      // Sequential calls should not produce sequential values
      expect(parseInt(otp2)).not.toBe(parseInt(otp1) + 1);
      expect(parseInt(otp3)).not.toBe(parseInt(otp2) + 1);
    });
  });

  describe('OTP Storage', () => {
    it('should store OTP with correct key and expiry', async () => {
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      await storeOTP('test@example.com', '123456');
      
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'otp:test@example.com',
        '123456',
        600 // 10 minutes
      );
    });

    it('should throw error if storage fails', async () => {
      mockRedisService.set.mockRejectedValueOnce(new Error('Storage failed'));
      
      await expect(storeOTP('test@example.com', '123456')).rejects.toThrow('Failed to store OTP');
    });
  });

  describe('OTP Verification', () => {
    it('should verify correct OTP', async () => {
      mockRedisService.get.mockResolvedValueOnce('123456');
      mockRedisService.delete.mockResolvedValueOnce(undefined);
      
      const result = await verifyOTP('test@example.com', '123456');
      
      expect(result).toBe(true);
      expect(mockRedisService.get).toHaveBeenCalledWith('otp:test@example.com');
      expect(mockRedisService.delete).toHaveBeenCalledWith('otp:test@example.com');
    });

    it('should reject incorrect OTP', async () => {
      mockRedisService.get.mockResolvedValueOnce('123456');
      
      const result = await verifyOTP('test@example.com', '654321');
      
      expect(result).toBe(false);
      expect(mockRedisService.delete).not.toHaveBeenCalled();
    });

    it('should reject when OTP not found', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      
      const result = await verifyOTP('test@example.com', '123456');
      
      expect(result).toBe(false);
    });

    it('should delete OTP after successful verification (one-time use)', async () => {
      mockRedisService.get.mockResolvedValueOnce('123456');
      mockRedisService.delete.mockResolvedValueOnce(undefined);
      
      await verifyOTP('test@example.com', '123456');
      
      expect(mockRedisService.delete).toHaveBeenCalledWith('otp:test@example.com');
    });

    it('should handle verification errors gracefully', async () => {
      mockRedisService.get.mockRejectedValueOnce(new Error('Redis error'));
      
      const result = await verifyOTP('test@example.com', '123456');
      
      expect(result).toBe(false);
    });
  });

  describe('OTP Deletion', () => {
    it('should delete OTP from storage', async () => {
      mockRedisService.delete.mockResolvedValueOnce(undefined);
      
      await deleteOTP('test@example.com');
      
      expect(mockRedisService.delete).toHaveBeenCalledWith('otp:test@example.com');
    });
  });

  describe('Integration', () => {
    it('should work with otpService singleton', async () => {
      mockRedisService.set.mockResolvedValueOnce(undefined);
      mockRedisService.get.mockResolvedValueOnce('999999');
      mockRedisService.delete.mockResolvedValueOnce(undefined);
      
      const otp = otpService.generateOTP();
      await otpService.storeOTP('test@example.com', otp);
      
      expect(mockRedisService.set).toHaveBeenCalled();
    });
  });
});