import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  isDevelopment, 
  isProduction, 
  getConfig, 
  getRequiredEnvVar, 
  getOptionalEnvVar 
} from '../../src/lib/config';

describe('config utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv } as any;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('environment detection', () => {
    it('isDevelopment returns true in development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
      expect(isDevelopment()).toBe(true);
    });

    it('isProduction returns true in production', () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
      expect(isProduction()).toBe(true);
    });

    it('defaults to development when NODE_ENV is not set', () => {
      delete (process.env as any).NODE_ENV;
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('returns correct values for development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const config = getConfig();
      expect(config.nodeEnv).toBe('development');
      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
      expect(config.appUrl).toBe('http://localhost:3000');
      expect(config.redisUrl).toBe('redis://localhost:6379');
    });

    it('returns correct values for production', () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
      process.env.NEXT_PUBLIC_APP_URL = 'https://yourdomain.com';

      const config = getConfig();
      expect(config.nodeEnv).toBe('production');
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
      expect(config.appUrl).toBe('https://yourdomain.com');
    });

    it('uses default app URL when not set', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      const config = getConfig();
      expect(config.appUrl).toBe('http://localhost:3000');
    });
  });

  describe('getRequiredEnvVar', () => {
    it('returns value when environment variable is set', () => {
      process.env.TEST_VAR = 'test-value';
      expect(getRequiredEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('throws error when environment variable is not set', () => {
      delete process.env.TEST_VAR;
      expect(() => getRequiredEnvVar('TEST_VAR')).toThrow('Required environment variable TEST_VAR is not set');
    });

    it('throws error when environment variable is empty string', () => {
      process.env.TEST_VAR = '';
      expect(() => getRequiredEnvVar('TEST_VAR')).toThrow('Required environment variable TEST_VAR is not set');
    });
  });

  describe('getOptionalEnvVar', () => {
    it('returns value when environment variable is set', () => {
      process.env.TEST_VAR = 'test-value';
      expect(getOptionalEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('returns undefined when environment variable is not set', () => {
      delete process.env.TEST_VAR;
      expect(getOptionalEnvVar('TEST_VAR')).toBeUndefined();
    });

    it('returns default value when environment variable is not set', () => {
      delete process.env.TEST_VAR;
      expect(getOptionalEnvVar('TEST_VAR', 'default-value')).toBe('default-value');
    });

    it('returns value when environment variable is set, ignoring default', () => {
      process.env.TEST_VAR = 'test-value';
      expect(getOptionalEnvVar('TEST_VAR', 'default-value')).toBe('test-value');
    });
  });
});
