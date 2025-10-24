/**
 * JWT token creation and validation utilities
 * Provides secure token generation, validation, and user authentication
 */

import jwt from 'jsonwebtoken';
import { getSecretSync } from './secrets';
import { isProduction } from './config';

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  success: boolean;
  user?: {
    userId: string;
    email: string;
  };
  error?: string;
}

// Token expiration times (in seconds)
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

/**
 * Gets the JWT secret from environment or secrets manager
 * @returns JWT secret string
 * @throws Error if secret is not found or too short
 */
function getJWTSecret(): string {
  const secret = getSecretSync('JWT_SECRET');
  
  if (!secret) {
    throw new Error('JWT_SECRET is required but not found');
  }
  
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  return secret;
}

/**
 * Creates a JWT token with the specified payload
 * @param payload - The JWT payload data
 * @param expiresIn - Token expiration time in seconds
 * @returns Signed JWT token string
 * @throws Error if token creation fails
 */
export function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: number = ACCESS_TOKEN_EXPIRY): string {
  try {
    const secret = getJWTSecret();
    
    const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      ...payload
    };
    
    return jwt.sign(tokenPayload, secret, {
      algorithm: 'HS256',
      expiresIn: expiresIn
    });
  } catch (error) {
    throw new Error(`Failed to create JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates a pair of access and refresh tokens for a user
 * @param userId - The user's unique identifier
 * @param email - The user's email address
 * @returns Object containing both tokens and expiration info
 * @throws Error if token creation fails
 */
export function createTokenPair(userId: string, email: string): TokenPair {
  try {
    const accessToken = createToken({
      userId,
      email,
      type: 'access'
    }, ACCESS_TOKEN_EXPIRY);
    
    const refreshToken = createToken({
      userId,
      email,
      type: 'refresh'
    }, REFRESH_TOKEN_EXPIRY);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    };
  } catch (error) {
    throw new Error(`Failed to create token pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verifies and decodes a JWT token
 * @param token - The JWT token to verify
 * @returns Decoded JWT payload if valid
 * @throws Error if token is invalid, expired, or malformed
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const secret = getJWTSecret();
    
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256']
    }) as JWTPayload;
    
    // Validate token structure
    if (!decoded.userId || !decoded.email || !decoded.type) {
      throw new Error('Invalid token structure');
    }
    
    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token has expired');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error(`Invalid token: ${error.message}`);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('Token not active yet');
    }
    throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts and verifies a token from the Authorization header
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns Decoded JWT payload if valid
 * @throws Error if header is malformed or token is invalid
 */
export function extractTokenFromHeader(authHeader: string): JWTPayload {
  try {
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new Error('Authorization header must be in format "Bearer <token>"');
    }
    
    const token = parts[1];
    if (!token) {
      throw new Error('Token is required in Authorization header');
    }
    
    return verifyToken(token);
  } catch (error) {
    throw new Error(`Failed to extract token from header: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates if a token is a valid access token
 * @param token - The JWT token to validate
 * @returns True if token is a valid access token
 */
export function isAccessToken(token: string): boolean {
  try {
    const payload = verifyToken(token);
    return payload.type === 'access';
  } catch (error) {
    return false;
  }
}

/**
 * Validates if a token is a valid refresh token
 * @param token - The JWT token to validate
 * @returns True if token is a valid refresh token
 */
export function isRefreshToken(token: string): boolean {
  try {
    const payload = verifyToken(token);
    return payload.type === 'refresh';
  } catch (error) {
    return false;
  }
}

/**
 * Authenticates a user using an access token
 * @param token - The access token to validate
 * @returns Authentication result with user info if successful
 */
export function authenticateUser(token: string): AuthResult {
  try {
    const payload = verifyToken(token);
    
    if (payload.type !== 'access') {
      return {
        success: false,
        error: 'Invalid token type. Access token required.'
      };
    }
    
    return {
      success: true,
      user: {
        userId: payload.userId,
        email: payload.email
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}

/**
 * Refreshes an access token using a valid refresh token
 * @param refreshToken - The refresh token to use
 * @returns New token pair if refresh token is valid
 * @throws Error if refresh token is invalid or expired
 */
export function refreshAccessToken(refreshToken: string): TokenPair {
  try {
    const payload = verifyToken(refreshToken);
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type. Refresh token required.');
    }
    
    return createTokenPair(payload.userId, payload.email);
  } catch (error) {
    throw new Error(`Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates token format without full verification (for middleware)
 * @param token - The token to validate
 * @returns True if token format is valid
 */
export function isValidTokenFormat(token: string): boolean {
  try {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    
    // Check if all parts are base64 encoded (JWT uses base64url encoding)
    for (const part of parts) {
      if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(part)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets token expiration time in seconds from now
 * @param token - The JWT token to check
 * @returns Seconds until expiration, or 0 if expired/invalid
 */
export function getTokenExpiration(token: string): number {
  try {
    const payload = verifyToken(token);
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, payload.exp - now);
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Checks if a token is expired without throwing an error
 * @param token - The JWT token to check
 * @returns True if token is expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = verifyToken(token);
    if (payload.exp) {
      return payload.exp < Math.floor(Date.now() / 1000);
    }
    return true;
  } catch (error) {
    return true;
  }
}
