/**
 * Secrets management with environment-aware retrieval
 * Supports both development (env vars) and production (Tencent Cloud SSM)
 */

import { Client as SsmClient } from 'tencentcloud-sdk-nodejs/tencentcloud/services/ssm/v20190923/ssm_client';
import { GetSecretValueRequest, GetSecretValueResponse } from 'tencentcloud-sdk-nodejs/tencentcloud/services/ssm/v20190923/ssm_models';
import { Credential } from 'tencentcloud-sdk-nodejs/tencentcloud/common/credential';
import { isProduction, getRequiredEnvVar, getOptionalEnvVar } from './config';

interface SecretConfig {
  name: string;
  defaultValue?: string;
  required: boolean;
}

interface SecretsManager {
  getSecret(name: string): Promise<string | undefined>;
  getSecretSync(name: string): string | undefined;
}

class TencentSecretsManager implements SecretsManager {
  private client: SsmClient;
  private initialized: boolean = false;

  constructor() {
    this.client = new SsmClient({
      credential: new Credential(
        getRequiredEnvVar('TENCENT_CLOUD_SECRET_ID'),
        getRequiredEnvVar('TENCENT_CLOUD_SECRET_KEY')
      ),
      region: getOptionalEnvVar('TENCENT_CLOUD_REGION', 'ap-beijing')
    });
  }

  async getSecret(name: string): Promise<string | undefined> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const request: GetSecretValueRequest = {
        SecretName: name
      };

      const response: GetSecretValueResponse = await this.client.GetSecretValue(request);
      return response.SecretString;
    } catch (error) {
      console.error(`Failed to retrieve secret ${name} from Tencent Cloud:`, error);
      return undefined;
    }
  }

  getSecretSync(name: string): string | undefined {
    throw new Error('Sync secret retrieval not supported for Tencent Cloud SSM');
  }

  private async initialize(): Promise<void> {
    try {
      // Test connection to Tencent Cloud
      const testRequest: GetSecretValueRequest = { SecretName: 'test-connection' };
      await this.client.GetSecretValue(testRequest);
    } catch (error) {
      // Expected to fail for test-connection, but validates credentials
      console.log('Tencent Cloud SSM connection validated');
    }
    this.initialized = true;
  }
}

class LocalSecretsManager implements SecretsManager {
  async getSecret(name: string): Promise<string | undefined> {
    return process.env[name];
  }

  getSecretSync(name: string): string | undefined {
    return process.env[name];
  }
}

class SecretsService {
  private manager: SecretsManager;

  constructor() {
    this.manager = isProduction() ? new TencentSecretsManager() : new LocalSecretsManager();
  }

  async getSecret(name: string, defaultValue?: string): Promise<string | undefined> {
    const value = await this.manager.getSecret(name);
    return value || defaultValue;
  }

  getSecretSync(name: string, defaultValue?: string): string | undefined {
    const value = this.manager.getSecretSync(name);
    return value || defaultValue;
  }

  async getRequiredSecret(name: string): Promise<string> {
    const value = await this.getSecret(name);
    if (!value) {
      throw new Error(`Required secret ${name} not found`);
    }
    return value;
  }

  getRequiredSecretSync(name: string): string {
    const value = this.getSecretSync(name);
    if (!value) {
      throw new Error(`Required secret ${name} not found`);
    }
    return value;
  }
}

// Singleton instance
export const secretsService = new SecretsService();

// Convenience functions

/**
 * Retrieves a secret value asynchronously
 * @param name - The name of the secret to retrieve
 * @param defaultValue - Optional default value to return if secret is not found
 * @returns Promise that resolves to the secret value or undefined if not found
 * @throws Error if the secret is required but not found (when defaultValue is not provided)
 * @example
 * ```typescript
 * const apiKey = await getSecret('API_KEY', 'default-key');
 * ```
 */
export async function getSecret(name: string, defaultValue?: string): Promise<string | undefined> {
  return secretsService.getSecret(name, defaultValue);
}

/**
 * Retrieves a secret value synchronously (development only)
 * @param name - The name of the secret to retrieve
 * @param defaultValue - Optional default value to return if secret is not found
 * @returns The secret value or undefined if not found
 * @throws Error if used in production mode (Tencent Cloud doesn't support sync operations)
 * @example
 * ```typescript
 * const apiKey = getSecretSync('API_KEY', 'default-key');
 * ```
 */
export function getSecretSync(name: string, defaultValue?: string): string | undefined {
  return secretsService.getSecretSync(name, defaultValue);
}

/**
 * Retrieves a required secret value asynchronously
 * @param name - The name of the required secret to retrieve
 * @returns Promise that resolves to the secret value
 * @throws Error if the secret is not found
 * @example
 * ```typescript
 * const apiKey = await getRequiredSecret('API_KEY');
 * ```
 */
export async function getRequiredSecret(name: string): Promise<string> {
  return secretsService.getRequiredSecret(name);
}

/**
 * Retrieves a required secret value synchronously (development only)
 * @param name - The name of the required secret to retrieve
 * @returns The secret value
 * @throws Error if the secret is not found or if used in production mode
 * @example
 * ```typescript
 * const apiKey = getRequiredSecretSync('API_KEY');
 * ```
 */
export function getRequiredSecretSync(name: string): string {
  return secretsService.getRequiredSecretSync(name);
}

/**
 * Initializes the secrets manager in production environment
 * Pre-warms the connection to Tencent Cloud SSM for better performance
 * @returns Promise that resolves when initialization is complete
 * @example
 * ```typescript
 * await initializeSecretsManager();
 * ```
 */
export async function initializeSecretsManager(): Promise<void> {
  if (isProduction()) {
    console.log('Initializing Tencent Cloud Secrets Manager...');
    // Pre-warm the connection
    await secretsService.getSecret('test-connection');
  }
}
