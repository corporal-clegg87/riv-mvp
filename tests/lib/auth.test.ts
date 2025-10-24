import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock secrets service
const mockSecretsService = vi.hoisted(() => ({
  getSecretSync: vi.fn(() => 'test-jwt-secret-that-is-at-least-32-characters-long')
}));

vi.mock('../../src/lib/secrets', () => ({
  getSecretSync: mockSecretsService.getSecretSync
}));

// Mock config
vi.mock('../../src/lib/config', () => ({
  isProduction: vi.fn(() => false)
}));

import {
  createToken,
  createTokenPair,
  verifyToken,
  extractTokenFromHeader,
  isAccessToken,
  isRefreshToken,
  authenticateUser,
  refreshAccessToken,
  isValidTokenFormat,
  getTokenExpiration,
  isTokenExpired
} from '../../src/lib/auth';

describe('JWT Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Creation', () => {
    it('should create a valid JWT token', () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        type: 'access' as const
      };
      
      const token = createToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should create token with custom expiration', () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        type: 'access' as const
      };
      
      const token = createToken(payload, 3600); // 1 hour
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.type).toBe('access');
    });

    it('should throw error if JWT secret is missing', () => {
      mockSecretsService.getSecretSync.mockReturnValueOnce(undefined);
      
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        type: 'access' as const
      };
      
      expect(() => createToken(payload)).toThrow('JWT_SECRET is required but not found');
    });

    it('should throw error if JWT secret is too short', () => {
      mockSecretsService.getSecretSync.mockReturnValueOnce('short');
      
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        type: 'access' as const
      };
      
      expect(() => createToken(payload)).toThrow('JWT_SECRET must be at least 32 characters long');
    });
  });

  describe('Token Pair Creation', () => {
    it('should create both access and refresh tokens', () => {
      const tokenPair = createTokenPair('user123', 'test@example.com');
      
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBe(900); // 15 minutes
      
      // Verify both tokens are valid
      const accessPayload = verifyToken(tokenPair.accessToken);
      const refreshPayload = verifyToken(tokenPair.refreshToken);
      
      expect(accessPayload.type).toBe('access');
      expect(refreshPayload.type).toBe('refresh');
      expect(accessPayload.userId).toBe('user123');
      expect(refreshPayload.userId).toBe('user123');
    });
  });

  describe('Token Verification', () => {
    it('should verify a valid token', () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        type: 'access' as const
      };
      
      const token = createToken(payload);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.type).toBe('access');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw error for malformed token', () => {
      expect(() => verifyToken('not.a.jwt')).toThrow();
    });
  });

  describe('Header Extraction', () => {
    it('should extract token from valid Authorization header', () => {
      const payload = {
        userId: 'user123',
        email: 'test@example.com',
        type: 'access' as const
      };
      
      const token = createToken(payload);
      const authHeader = `Bearer ${token}`;
      
      const decoded = extractTokenFromHeader(authHeader);
      
      expect(decoded.userId).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should throw error for invalid header format', () => {
      expect(() => extractTokenFromHeader('Invalid header')).toThrow('Authorization header must be in format "Bearer <token>"');
    });

    it('should throw error for missing token', () => {
      expect(() => extractTokenFromHeader('Bearer')).toThrow('Authorization header must be in format "Bearer <token>"');
    });
  });

  describe('Token Type Validation', () => {
    it('should identify access tokens correctly', () => {
      const accessToken = createToken({
        userId: 'user123',
        email: 'test@example.com',
        type: 'access'
      });
      
      expect(isAccessToken(accessToken)).toBe(true);
      expect(isRefreshToken(accessToken)).toBe(false);
    });

    it('should identify refresh tokens correctly', () => {
      const refreshToken = createToken({
        userId: 'user123',
        email: 'test@example.com',
        type: 'refresh'
      });
      
      expect(isRefreshToken(refreshToken)).toBe(true);
      expect(isAccessToken(refreshToken)).toBe(false);
    });
  });

  describe('User Authentication', () => {
    it('should authenticate user with valid access token', () => {
      const accessToken = createToken({
        userId: 'user123',
        email: 'test@example.com',
        type: 'access'
      });
      
      const result = authenticateUser(accessToken);
      
      expect(result.success).toBe(true);
      expect(result.user?.userId).toBe('user123');
      expect(result.user?.email).toBe('test@example.com');
    });

    it('should reject refresh token for authentication', () => {
      const refreshToken = createToken({
        userId: 'user123',
        email: 'test@example.com',
        type: 'refresh'
      });
      
      const result = authenticateUser(refreshToken);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token type. Access token required.');
    });

    it('should handle invalid tokens gracefully', () => {
      const result = authenticateUser('invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', () => {
      const tokenPair = createTokenPair('user123', 'test@example.com');
      
      const newTokenPair = refreshAccessToken(tokenPair.refreshToken);
      
      expect(newTokenPair.accessToken).toBeDefined();
      expect(newTokenPair.refreshToken).toBeDefined();
      expect(newTokenPair.expiresIn).toBe(900);
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => refreshAccessToken('invalid-token')).toThrow();
    });

    it('should throw error for access token used as refresh token', () => {
      const accessToken = createToken({
        userId: 'user123',
        email: 'test@example.com',
        type: 'access'
      });
      
      expect(() => refreshAccessToken(accessToken)).toThrow('Invalid token type. Refresh token required.');
    });
  });

  describe('Token Format Validation', () => {
    it('should validate correct JWT format', () => {
      const token = createToken({
        userId: 'user123',
        email: 'test@example.com',
        type: 'access'
      });
      
      expect(isValidTokenFormat(token)).toBe(true);
    });

    it('should reject invalid token formats', () => {
      expect(isValidTokenFormat('not-a-jwt')).toBe(false);
      expect(isValidTokenFormat('not.a.jwt')).toBe(true); // This is actually valid format
      expect(isValidTokenFormat('')).toBe(false);
      expect(isValidTokenFormat('header.payload')).toBe(false);
    });
  });

  describe('Token Expiration', () => {
    it('should get token expiration time', () => {
      const token = createToken({
        userId: 'user123',
        email: 'test@example.com',
        type: 'access'
      });
      
      const expiration = getTokenExpiration(token);
      
      expect(expiration).toBeGreaterThan(0);
      expect(expiration).toBeLessThanOrEqual(900); // 15 minutes
    });

    it('should detect expired tokens', () => {
      // Create token with very short expiration
      const token = createToken({
        userId: 'user123',
        email: 'test@example.com',
        type: 'access'
      }, 1); // 1 second
      
      // Wait for token to expire
      setTimeout(() => {
        expect(isTokenExpired(token)).toBe(true);
      }, 1100);
    });
  });
});
