import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getSecret, 
  getSecretSync, 
  getRequiredSecret, 
  getRequiredSecretSync,
  initializeSecretsManager,
  secretsService 
} from '../../src/lib/secrets';

// Mock the config module
vi.mock('../../src/lib/config', () => ({
  isProduction: vi.fn(() => false),
  getRequiredEnvVar: vi.fn((name: string) => {
    if (name === 'TENCENT_CLOUD_SECRET_ID') return 'test-secret-id';
    if (name === 'TENCENT_CLOUD_SECRET_KEY') return 'test-secret-key';
    throw new Error(`Required env var ${name} not found`);
  }),
  getOptionalEnvVar: vi.fn((name: string, defaultValue?: string) => {
    if (name === 'TENCENT_CLOUD_REGION') return 'ap-beijing';
    return defaultValue;
  })
}));

// Mock Tencent Cloud SDK
vi.mock('@tencentcloud/ssm-20190923', () => ({
  SsmClient: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  GetSecretValueCommand: vi.fn().mockImplementation((params) => params)
}));

// Mock tencentcloud-sdk-nodejs
vi.mock('tencentcloud-sdk-nodejs/tencentcloud/common/credential', () => ({
  Credential: vi.fn()
}));

describe('Secrets Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.TEST_SECRET;
    delete process.env.REQUIRED_SECRET;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('LocalSecretsManager (Development)', () => {
    it('should retrieve environment variables correctly', async () => {
      process.env.TEST_SECRET = 'test-value';
      
      const result = await getSecret('TEST_SECRET');
      expect(result).toBe('test-value');
    });

    it('should return undefined for non-existent secrets', async () => {
      const result = await getSecret('NON_EXISTENT_SECRET');
      expect(result).toBeUndefined();
    });

    it('should return default value when secret not found', async () => {
      const result = await getSecret('NON_EXISTENT_SECRET', 'default-value');
      expect(result).toBe('default-value');
    });

    it('should work with sync methods', () => {
      process.env.TEST_SECRET = 'sync-test-value';
      
      const result = getSecretSync('TEST_SECRET');
      expect(result).toBe('sync-test-value');
    });

    it('should throw error for required secrets that are missing', async () => {
      await expect(getRequiredSecret('MISSING_REQUIRED_SECRET')).rejects.toThrow(
        'Required secret MISSING_REQUIRED_SECRET not found'
      );
    });

    it('should throw error for required secrets that are missing (sync)', () => {
      expect(() => getRequiredSecretSync('MISSING_REQUIRED_SECRET')).toThrow(
        'Required secret MISSING_REQUIRED_SECRET not found'
      );
    });
  });

  describe('SecretsService', () => {
    it('should use LocalSecretsManager in development', () => {
      process.env.TEST_SECRET = 'development-value';
      
      const result = getSecretSync('TEST_SECRET');
      expect(result).toBe('development-value');
    });

    it('should handle async operations correctly', async () => {
      process.env.ASYNC_SECRET = 'async-value';
      
      const result = await getSecret('ASYNC_SECRET');
      expect(result).toBe('async-value');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required secrets gracefully', async () => {
      await expect(getRequiredSecret('MISSING_SECRET')).rejects.toThrow(
        'Required secret MISSING_SECRET not found'
      );
    });

    it('should provide clear error messages', () => {
      expect(() => getRequiredSecretSync('MISSING_SECRET')).toThrow(
        'Required secret MISSING_SECRET not found'
      );
    });
  });

  describe('Integration', () => {
    it('should work with secretsService singleton', async () => {
      process.env.INTEGRATION_TEST = 'integration-value';
      
      const result = await secretsService.getSecret('INTEGRATION_TEST');
      expect(result).toBe('integration-value');
    });

    it('should handle initialization in development', async () => {
      // Should not throw in development
      await expect(initializeSecretsManager()).resolves.toBeUndefined();
    });
  });
});
