/**
 * OTP generation and storage
 * Provides one-time password functionality with Redis-backed storage
 */

import { randomInt } from 'crypto';
import { redisService } from './redis';
import { logger } from './logger';
import { getOptionalEnvVar } from './config';

const OTP_EXPIRY_SECONDS = parseInt(getOptionalEnvVar('OTP_EXPIRY_SECONDS', '600')); // 10 minutes default
const OTP_PREFIX = getOptionalEnvVar('OTP_PREFIX', 'otp:');

/**
 * One-Time Password (OTP) Service
 * 
 * Provides secure OTP generation, storage, and verification functionality with Redis-backed persistence.
 * OTPs are cryptographically secure, have configurable expiration times, and are single-use only.
 * 
 * Features:
 * - Cryptographically secure 6-digit OTP generation
 * - Redis-backed storage with automatic expiration
 * - One-time use semantics (OTP deleted after successful verification)
 * - Graceful fallback to in-memory storage when Redis is unavailable
 * - Comprehensive logging and error handling
 * 
 * Usage:
 * ```typescript
 * import { generateOTP, storeOTP, verifyOTP } from './otp';
 * 
 * // Generate and store OTP
 * const otp = generateOTP();
 * await storeOTP('user@example.com', otp);
 * 
 * // Verify OTP
 * const isValid = await verifyOTP('user@example.com', userInput);
 * ```
 * 
 * Configuration:
 * - OTP_EXPIRY_SECONDS: OTP expiration time in seconds (default: 600)
 * - OTP_PREFIX: Redis key prefix for OTP storage (default: 'otp:')
 * 
 * @class OTPService
 */
class OTPService {
  /**
   * Generates a cryptographically secure 6-digit OTP
   * @returns 6-digit numeric string
   */
  generateOTP(): string {
    // Generate random 6-digit number (100000-999999)
    const otp = randomInt(100000, 1000000);
    return otp.toString();
  }

  /**
   * Stores an OTP for a given identifier (typically email)
   * @param identifier - Unique identifier (email address)
   * @param otp - The OTP code to store
   * @returns Promise that resolves when OTP is stored
   */
  async storeOTP(identifier: string, otp: string): Promise<void> {
    const key = `${OTP_PREFIX}${identifier}`;
    
    try {
      await redisService.set(key, otp, OTP_EXPIRY_SECONDS);
      logger.info('OTP stored', { 
        identifier, 
        expirySeconds: OTP_EXPIRY_SECONDS,
        redisConnected: redisService.isConnected()
      });
    } catch (error) {
      logger.error('Failed to store OTP', { 
        identifier, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, error instanceof Error ? error : undefined);
      throw new Error('Failed to store OTP');
    }
  }

  /**
   * Verifies an OTP for a given identifier
   * @param identifier - Unique identifier (email address)
   * @param otp - The OTP code to verify
   * @returns Promise that resolves to true if OTP is valid, false otherwise
   */
  async verifyOTP(identifier: string, otp: string): Promise<boolean> {
    const key = `${OTP_PREFIX}${identifier}`;
    
    try {
      const storedOTP = await redisService.get(key);
      
      if (!storedOTP) {
        logger.warn('OTP verification failed - not found', { identifier });
        return false;
      }

      const isValid = storedOTP === otp;
      
      if (isValid) {
        // Delete OTP after successful verification (one-time use)
        await this.deleteOTP(identifier);
        logger.info('OTP verified successfully', { identifier });
      } else {
        logger.warn('OTP verification failed - mismatch', { identifier });
      }
      
      return isValid;
    } catch (error) {
      logger.error('OTP verification error', { 
        identifier, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Deletes an OTP for a given identifier
   * @param identifier - Unique identifier (email address)
   */
  async deleteOTP(identifier: string): Promise<void> {
    const key = `${OTP_PREFIX}${identifier}`;
    await redisService.delete(key);
  }
}

// Singleton instance
export const otpService = new OTPService();

// Convenience exports
export const generateOTP = () => otpService.generateOTP();
export const storeOTP = (identifier: string, otp: string) => otpService.storeOTP(identifier, otp);
export const verifyOTP = (identifier: string, otp: string) => otpService.verifyOTP(identifier, otp);
export const deleteOTP = (identifier: string) => otpService.deleteOTP(identifier);
