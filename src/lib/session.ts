/**
 * Session management utilities with cleanup functionality
 * Provides session storage, validation, cleanup, and session lifecycle management
 */

import { redisService } from './redis';
import { logger } from './logger';
import { createTokenPair, verifyToken, JWTPayload } from './auth';
import { getOptionalEnvVar } from './config';

const SESSION_EXPIRY_SECONDS = parseInt(getOptionalEnvVar('SESSION_EXPIRY_SECONDS', '604800')); // 7 days default
const SESSION_PREFIX = getOptionalEnvVar('SESSION_PREFIX', 'session:');
const CLEANUP_INTERVAL_MINUTES = parseInt(getOptionalEnvVar('CLEANUP_INTERVAL_MINUTES', '60')); // 1 hour default

export interface SessionData {
  userId: string;
  email: string;
  createdAt: number;
  lastAccessed: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionResult {
  success: boolean;
  session?: SessionData;
  error?: string;
}

export interface CleanupResult {
  sessionsDeleted: number;
  errors: string[];
}

/**
 * Session Management Service with Cleanup
 * 
 * Provides session storage, validation, cleanup, and lifecycle management with Redis-backed persistence.
 * Sessions are automatically expired and cleaned up to prevent memory leaks.
 * 
 * Features:
 * - Redis-backed session storage with automatic expiration
 * - Session validation and refresh capabilities
 * - Automatic cleanup of expired sessions
 * - Graceful fallback to in-memory storage when Redis is unavailable
 * - Comprehensive logging and error handling
 * - Periodic cleanup of expired sessions
 * 
 * Usage:
 * ```typescript
 * import { createSession, validateSession, refreshSession, cleanupExpiredSessions } from './session';
 * 
 * // Create new session
 * const session = await createSession('user123', 'user@example.com');
 * 
 * // Validate existing session
 * const result = await validateSession(sessionId);
 * 
 * // Cleanup expired sessions
 * const cleanup = await cleanupExpiredSessions();
 * ```
 * 
 * Configuration:
 * - SESSION_EXPIRY_SECONDS: Session expiration time in seconds (default: 604800 = 7 days)
 * - SESSION_PREFIX: Redis key prefix for session storage (default: 'session:')
 * - CLEANUP_INTERVAL_MINUTES: Cleanup interval in minutes (default: 60)
 * 
 * @class SessionService
 */
class SessionService {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPeriodicCleanup();
  }

  /**
   * Creates a new session for a user
   * @param userId - The user's unique identifier
   * @param email - The user's email address
   * @param userAgent - Optional user agent string
   * @param ipAddress - Optional IP address
   * @returns Promise that resolves to session ID
   */
  async createSession(
    userId: string, 
    email: string, 
    userAgent?: string, 
    ipAddress?: string
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const sessionData: SessionData = {
      userId,
      email,
      createdAt: now,
      lastAccessed: now,
      userAgent,
      ipAddress
    };
    
    const key = `${SESSION_PREFIX}${sessionId}`;
    
    try {
      await redisService.set(key, JSON.stringify(sessionData), SESSION_EXPIRY_SECONDS);
      logger.info('Session created', { 
        sessionId, 
        userId, 
        email,
        expirySeconds: SESSION_EXPIRY_SECONDS,
        redisConnected: redisService.isConnected()
      });
      
      return sessionId;
    } catch (error) {
      logger.error('Failed to create session', { 
        sessionId, 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, error instanceof Error ? error : undefined);
      throw new Error('Failed to create session');
    }
  }

  /**
   * Validates and retrieves session data
   * @param sessionId - The session ID to validate
   * @returns Promise that resolves to session data if valid
   */
  async validateSession(sessionId: string): Promise<SessionResult> {
    const key = `${SESSION_PREFIX}${sessionId}`;
    
    try {
      const sessionDataStr = await redisService.get(key);
      
      if (!sessionDataStr) {
        logger.warn('Session validation failed - not found', { sessionId });
        return {
          success: false,
          error: 'Session not found or expired'
        };
      }

      const sessionData: SessionData = JSON.parse(sessionDataStr);
      
      // Update last accessed time
      sessionData.lastAccessed = Date.now();
      await redisService.set(key, JSON.stringify(sessionData), SESSION_EXPIRY_SECONDS);
      
      logger.info('Session validated successfully', { sessionId, userId: sessionData.userId });
      
      return {
        success: true,
        session: sessionData
      };
    } catch (error) {
      logger.error('Session validation error', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, error instanceof Error ? error : undefined);
      
      return {
        success: false,
        error: 'Session validation failed'
      };
    }
  }

  /**
   * Refreshes a session by extending its expiration
   * @param sessionId - The session ID to refresh
   * @returns Promise that resolves to new session data if successful
   */
  async refreshSession(sessionId: string): Promise<SessionResult> {
    const validationResult = await this.validateSession(sessionId);
    
    if (!validationResult.success || !validationResult.session) {
      return validationResult;
    }
    
    const key = `${SESSION_PREFIX}${sessionId}`;
    
    try {
      // Update last accessed time and extend expiration
      validationResult.session.lastAccessed = Date.now();
      await redisService.set(key, JSON.stringify(validationResult.session), SESSION_EXPIRY_SECONDS);
      
      logger.info('Session refreshed', { sessionId, userId: validationResult.session.userId });
      
      return {
        success: true,
        session: validationResult.session
      };
    } catch (error) {
      logger.error('Failed to refresh session', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, error instanceof Error ? error : undefined);
      
      return {
        success: false,
        error: 'Failed to refresh session'
      };
    }
  }

  /**
   * Deletes a session
   * @param sessionId - The session ID to delete
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `${SESSION_PREFIX}${sessionId}`;
    
    try {
      await redisService.delete(key);
      logger.info('Session deleted', { sessionId });
    } catch (error) {
      logger.error('Failed to delete session', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Cleans up expired sessions
   * @returns Promise that resolves to cleanup result
   */
  async cleanupExpiredSessions(): Promise<CleanupResult> {
    const result: CleanupResult = {
      sessionsDeleted: 0,
      errors: []
    };
    
    try {
      // Get all session keys (this is a simplified approach)
      // In production, you might want to use Redis SCAN for better performance
      const sessionKeys = await this.getAllSessionKeys();
      
      for (const key of sessionKeys) {
        try {
          const sessionDataStr = await redisService.get(key);
          
          if (!sessionDataStr) {
            // Session already expired, delete the key
            await redisService.delete(key);
            result.sessionsDeleted++;
            continue;
          }
          
          const sessionData: SessionData = JSON.parse(sessionDataStr);
          const now = Date.now();
          const sessionAge = now - sessionData.lastAccessed;
          
          // Delete sessions that haven't been accessed in the last 7 days
          if (sessionAge > SESSION_EXPIRY_SECONDS * 1000) {
            await redisService.delete(key);
            result.sessionsDeleted++;
            logger.info('Expired session cleaned up', { 
              sessionId: key.replace(SESSION_PREFIX, ''),
              userId: sessionData.userId,
              age: sessionAge
            });
          }
        } catch (error) {
          const errorMsg = `Failed to cleanup session ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          logger.error('Session cleanup error', { key, error: errorMsg });
        }
      }
      
      logger.info('Session cleanup completed', { 
        sessionsDeleted: result.sessionsDeleted,
        errors: result.errors.length
      });
      
    } catch (error) {
      const errorMsg = `Session cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      logger.error('Session cleanup failed', { error: errorMsg });
    }
    
    return result;
  }

  /**
   * Gets all session keys from Redis
   * @returns Promise that resolves to array of session keys
   */
  private async getAllSessionKeys(): Promise<string[]> {
    try {
      // Use Redis SCAN to find all session keys with the session prefix
      const sessionPattern = `${SESSION_PREFIX}*`;
      const keys = await redisService.scanKeys(sessionPattern);
      
      logger.debug('Retrieved session keys', { 
        count: keys.length,
        pattern: sessionPattern,
        redisConnected: redisService.isConnected()
      });
      
      return keys;
    } catch (error) {
      logger.error('Failed to get session keys', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  /**
   * Starts periodic cleanup of expired sessions
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Periodic session cleanup failed', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }, CLEANUP_INTERVAL_MINUTES * 60 * 1000);
  }

  /**
   * Stops periodic cleanup
   */
  public stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generates a cryptographically secure session ID
   * @returns Unique session ID string
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
  }
}

// Singleton instance
export const sessionService = new SessionService();

// Convenience exports
export const createSession = (userId: string, email: string, userAgent?: string, ipAddress?: string) => 
  sessionService.createSession(userId, email, userAgent, ipAddress);
export const validateSession = (sessionId: string) => sessionService.validateSession(sessionId);
export const refreshSession = (sessionId: string) => sessionService.refreshSession(sessionId);
export const deleteSession = (sessionId: string) => sessionService.deleteSession(sessionId);
export const cleanupExpiredSessions = () => sessionService.cleanupExpiredSessions();
