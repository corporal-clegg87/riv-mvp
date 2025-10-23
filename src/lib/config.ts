/**
 * Environment configuration utilities
 * Provides centralized access to environment detection and configuration
 */

export function isDevelopment(): boolean {
  return (process.env.NODE_ENV || 'development') === 'development';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export interface AppConfig {
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  appUrl: string;
  redisUrl?: string;
}

export function getConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: isDevelopment(),
    isProduction: isProduction(),
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    redisUrl: process.env.REDIS_URL
  };
}

export function getRequiredEnvVar(name: string): string {
  try {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Environment configuration error: ${error.message}`);
    }
    throw new Error(`Failed to access environment variable ${name}`);
  }
}

export function getOptionalEnvVar(name: string, defaultValue?: string): string | undefined {
  try {
    return process.env[name] || defaultValue;
  } catch (error) {
    console.warn(`Warning: Failed to access environment variable ${name}, using default value`);
    return defaultValue;
  }
}

// Type validation for environment variables
export function validateEnvVar(name: string, value: string, expectedType: 'string' | 'number' | 'boolean'): boolean {
  try {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string' && value.length > 0;
      case 'number':
        return !isNaN(Number(value));
      case 'boolean':
        return value === 'true' || value === 'false';
      default:
        return false;
    }
  } catch (error) {
    console.warn(`Warning: Failed to validate environment variable ${name} as ${expectedType}`);
    return false;
  }
}

// Runtime type checking for critical environment variables
export function validateRequiredEnvVars(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Validate JWT secret length
    const jwtSecret = getOptionalEnvVar('JWT_SECRET');
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
    
    // Validate email format if provided
    const fromEmail = getOptionalEnvVar('TENCENT_SES_FROM_EMAIL');
    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      errors.push('TENCENT_SES_FROM_EMAIL must be a valid email address');
    }
    
    // Validate port number if provided
    const port = getOptionalEnvVar('TENCENT_SES_SMTP_PORT');
    if (port && !validateEnvVar('TENCENT_SES_SMTP_PORT', port, 'number')) {
      errors.push('TENCENT_SES_SMTP_PORT must be a valid number');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}
