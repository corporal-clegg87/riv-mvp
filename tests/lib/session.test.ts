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

// Mock auth module
vi.mock('../../src/lib/auth', () => ({
  createTokenPair: vi.fn()
}));

import { createSession, validateSession, refreshSession, deleteSession, cleanupExpiredSessions, sessionService } from '../../src/lib/session';

describe('Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Creation', () => {
    it('should create a new session', async () => {
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      const sessionId = await createSession('user123', 'test@example.com');
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.any(String),
        604800 // 7 days
      );
    });

    it('should create session with user agent and IP', async () => {
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      const sessionId = await createSession(
        'user123', 
        'test@example.com', 
        'Mozilla/5.0', 
        '192.168.1.1'
      );
      
      expect(sessionId).toBeDefined();
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should throw error if session creation fails', async () => {
      mockRedisService.set.mockRejectedValueOnce(new Error('Storage failed'));
      
      await expect(createSession('user123', 'test@example.com')).rejects.toThrow('Failed to create session');
    });
  });

  describe('Session Validation', () => {
    it('should validate existing session', async () => {
      const sessionData = {
        userId: 'user123',
        email: 'test@example.com',
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1'
      };
      
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(sessionData));
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      const result = await validateSession('session123');
      
      expect(result.success).toBe(true);
      expect(result.session?.userId).toBe('user123');
      expect(result.session?.email).toBe('test@example.com');
    });

    it('should return error for non-existent session', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      
      const result = await validateSession('nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found or expired');
    });

    it('should handle validation errors gracefully', async () => {
      mockRedisService.get.mockRejectedValueOnce(new Error('Redis error'));
      
      const result = await validateSession('session123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session validation failed');
    });
  });

  describe('Session Refresh', () => {
    it('should refresh valid session', async () => {
      const sessionData = {
        userId: 'user123',
        email: 'test@example.com',
        createdAt: Date.now(),
        lastAccessed: Date.now()
      };
      
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(sessionData));
      mockRedisService.set.mockResolvedValueOnce(undefined);
      
      const result = await refreshSession('session123');
      
      expect(result.success).toBe(true);
      expect(result.session?.userId).toBe('user123');
    });

    it('should return error for invalid session refresh', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      
      const result = await refreshSession('nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found or expired');
    });
  });

  describe('Session Deletion', () => {
    it('should delete session', async () => {
      mockRedisService.delete.mockResolvedValueOnce(undefined);
      
      await deleteSession('session123');
      
      expect(mockRedisService.delete).toHaveBeenCalledWith('session:session123');
    });

    it('should handle deletion errors gracefully', async () => {
      mockRedisService.delete.mockRejectedValueOnce(new Error('Delete failed'));
      
      // Should not throw error
      await expect(deleteSession('session123')).resolves.toBeUndefined();
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup expired sessions', async () => {
      const expiredSessionData = {
        userId: 'user123',
        email: 'test@example.com',
        createdAt: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
        lastAccessed: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
      };
      
      const activeSessionData = {
        userId: 'user456',
        email: 'active@example.com',
        createdAt: Date.now(),
        lastAccessed: Date.now()
      };
      
      // Mock getAllSessionKeys to return test keys
      vi.spyOn(sessionService as any, 'getAllSessionKeys').mockResolvedValueOnce([
        'session:expired123',
        'session:active456'
      ]);
      
      mockRedisService.get
        .mockResolvedValueOnce(JSON.stringify(expiredSessionData)) // expired session
        .mockResolvedValueOnce(JSON.stringify(activeSessionData)); // active session
      
      mockRedisService.delete.mockResolvedValue(undefined);
      
      const result = await cleanupExpiredSessions();
      
      expect(result.sessionsDeleted).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockRedisService.delete).toHaveBeenCalledWith('session:expired123');
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.spyOn(sessionService as any, 'getAllSessionKeys').mockRejectedValueOnce(new Error('Redis error'));
      
      const result = await cleanupExpiredSessions();
      
      expect(result.sessionsDeleted).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Session cleanup failed');
    });
  });

  describe('Session ID Generation', () => {
    it('should generate unique session IDs', async () => {
      mockRedisService.set.mockResolvedValue(undefined);
      
      const sessionIds = new Set();
      
      for (let i = 0; i < 10; i++) {
        const sessionId = await createSession('user123', 'test@example.com');
        sessionIds.add(sessionId);
      }
      
      expect(sessionIds.size).toBe(10);
    });
  });

  describe('Integration', () => {
    it('should work with sessionService singleton', async () => {
      mockRedisService.set.mockResolvedValueOnce(undefined);
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify({
        userId: 'user123',
        email: 'test@example.com',
        createdAt: Date.now(),
        lastAccessed: Date.now()
      }));
      
      const sessionId = await sessionService.createSession('user123', 'test@example.com');
      const result = await sessionService.validateSession(sessionId);
      
      expect(result.success).toBe(true);
    });
  });
});
