import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  isDevelopment, 
  isProduction, 
  getConfig, 
  getRequiredEnvVar, 
  getOptionalEnvVar,
  validateEnvVar,
  validateRequiredEnvVars,
  getTencentCloudConfig
} from '../../src/lib/config';

describe('config utilities', () => {
  beforeEach(() => {
    // Clear all environment variable stubs
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    // Restore original environment
    vi.unstubAllEnvs();
  });

  describe('environment detection', () => {
    it('isDevelopment returns true in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(isDevelopment()).toBe(true);
    });

    it('isProduction returns true in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(isProduction()).toBe(true);
    });

    it('defaults to development when NODE_ENV is not set', () => {
      vi.unstubAllEnvs();
      delete (process.env as any).NODE_ENV;
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('returns correct values for development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
      vi.stubEnv('REDIS_URL', 'redis://localhost:6379');

      const config = getConfig();
      expect(config.nodeEnv).toBe('development');
      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
      expect(config.appUrl).toBe('http://localhost:3000');
      expect(config.redisUrl).toBe('redis://localhost:6379');
    });

    it('returns correct values for production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://yourdomain.com');

      const config = getConfig();
      expect(config.nodeEnv).toBe('production');
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
      expect(config.appUrl).toBe('https://yourdomain.com');
    });

    it('uses default app URL when not set', () => {
      vi.unstubAllEnvs();
      delete (process.env as any).NEXT_PUBLIC_APP_URL;
      const config = getConfig();
      expect(config.appUrl).toBe('http://localhost:3000');
    });
  });

  describe('getRequiredEnvVar', () => {
    it('returns value when environment variable is set', () => {
      vi.stubEnv('TEST_VAR', 'test-value');
      expect(getRequiredEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('throws error when environment variable is not set', () => {
      vi.unstubAllEnvs();
      delete (process.env as any).TEST_VAR;
      expect(() => getRequiredEnvVar('TEST_VAR')).toThrow('Required environment variable TEST_VAR is not set');
    });

    it('throws error when environment variable is empty string', () => {
      vi.stubEnv('TEST_VAR', '');
      expect(() => getRequiredEnvVar('TEST_VAR')).toThrow('Required environment variable TEST_VAR is not set');
    });
  });

  describe('getOptionalEnvVar', () => {
    it('returns value when environment variable is set', () => {
      vi.stubEnv('TEST_VAR', 'test-value');
      expect(getOptionalEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('returns undefined when environment variable is not set', () => {
      vi.unstubAllEnvs();
      delete (process.env as any).TEST_VAR;
      expect(getOptionalEnvVar('TEST_VAR')).toBeUndefined();
    });

    it('returns default value when environment variable is not set', () => {
      vi.unstubAllEnvs();
      delete (process.env as any).TEST_VAR;
      expect(getOptionalEnvVar('TEST_VAR', 'default-value')).toBe('default-value');
    });

    it('returns value when environment variable is set, ignoring default', () => {
      vi.stubEnv('TEST_VAR', 'test-value');
      expect(getOptionalEnvVar('TEST_VAR', 'default-value')).toBe('test-value');
    });
  });

  describe('validateEnvVar', () => {
    it('validates string type correctly', () => {
      expect(validateEnvVar('TEST_VAR', 'valid-string', 'string')).toBe(true);
      expect(validateEnvVar('TEST_VAR', '', 'string')).toBe(false);
    });

    it('validates number type correctly', () => {
      expect(validateEnvVar('TEST_VAR', '123', 'number')).toBe(true);
      expect(validateEnvVar('TEST_VAR', 'abc', 'number')).toBe(false);
      expect(validateEnvVar('TEST_VAR', '12.34', 'number')).toBe(true);
    });

    it('validates boolean type correctly', () => {
      expect(validateEnvVar('TEST_VAR', 'true', 'boolean')).toBe(true);
      expect(validateEnvVar('TEST_VAR', 'false', 'boolean')).toBe(true);
      expect(validateEnvVar('TEST_VAR', 'yes', 'boolean')).toBe(false);
    });
  });

  describe('validateRequiredEnvVars', () => {
    it('validates JWT secret length', () => {
      vi.stubEnv('JWT_SECRET', 'short');
      const result = validateRequiredEnvVars();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('JWT_SECRET must be at least 32 characters long');
    });

    it('validates email format', () => {
      vi.stubEnv('TENCENT_SES_FROM_EMAIL', 'invalid-email');
      const result = validateRequiredEnvVars();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TENCENT_SES_FROM_EMAIL must be a valid email address');
    });

    it('validates port number', () => {
      vi.stubEnv('TENCENT_SES_SMTP_PORT', 'not-a-number');
      const result = validateRequiredEnvVars();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TENCENT_SES_SMTP_PORT must be a valid number');
    });

    it('passes validation with valid environment variables', () => {
      vi.stubEnv('JWT_SECRET', 'a'.repeat(32));
      vi.stubEnv('TENCENT_SES_FROM_EMAIL', 'test@example.com');
      vi.stubEnv('TENCENT_SES_SMTP_PORT', '587');
      
      const result = validateRequiredEnvVars();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('handles missing environment variables gracefully', () => {
      vi.unstubAllEnvs();
      delete (process.env as any).JWT_SECRET;
      delete (process.env as any).TENCENT_SES_FROM_EMAIL;
      delete (process.env as any).TENCENT_SES_SMTP_PORT;
      
      const result = validateRequiredEnvVars();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getTencentCloudConfig', () => {
    it('passes validation in development environment', () => {
      vi.stubEnv('NODE_ENV', 'development');
      
      const result = getTencentCloudConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates required Tencent Cloud credentials in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      // Don't set Tencent Cloud credentials to test validation
      delete (process.env as any).TENCENT_CLOUD_SECRET_ID;
      delete (process.env as any).TENCENT_CLOUD_SECRET_KEY;
      
      const result = getTencentCloudConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TENCENT_CLOUD_SECRET_ID is required in production');
      expect(result.errors).toContain('TENCENT_CLOUD_SECRET_KEY is required in production');
    });

    it('validates region format in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('TENCENT_CLOUD_SECRET_ID', 'test-id');
      vi.stubEnv('TENCENT_CLOUD_SECRET_KEY', 'test-key');
      vi.stubEnv('TENCENT_CLOUD_REGION', 'invalid-region');
      
      const result = getTencentCloudConfig();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TENCENT_CLOUD_REGION must be a valid Tencent Cloud region code');
    });

    it('uses default region when not specified in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('TENCENT_CLOUD_SECRET_ID', 'test-id');
      vi.stubEnv('TENCENT_CLOUD_SECRET_KEY', 'test-key');
      // Don't set TENCENT_CLOUD_REGION to test default behavior
      
      const result = getTencentCloudConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes validation with valid credentials in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('TENCENT_CLOUD_SECRET_ID', 'test-id');
      vi.stubEnv('TENCENT_CLOUD_SECRET_KEY', 'test-key');
      vi.stubEnv('TENCENT_CLOUD_REGION', 'ap-beijing');
      
      const result = getTencentCloudConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

});
