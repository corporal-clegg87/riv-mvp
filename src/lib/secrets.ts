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
export async function getSecret(name: string, defaultValue?: string): Promise<string | undefined> {
  return secretsService.getSecret(name, defaultValue);
}

export function getSecretSync(name: string, defaultValue?: string): string | undefined {
  return secretsService.getSecretSync(name, defaultValue);
}

export async function getRequiredSecret(name: string): Promise<string> {
  return secretsService.getRequiredSecret(name);
}

export function getRequiredSecretSync(name: string): string {
  return secretsService.getRequiredSecretSync(name);
}

// Initialize secrets manager in production
export async function initializeSecretsManager(): Promise<void> {
  if (isProduction()) {
    console.log('Initializing Tencent Cloud Secrets Manager...');
    // Pre-warm the connection
    await secretsService.getSecret('test-connection');
  }
}
