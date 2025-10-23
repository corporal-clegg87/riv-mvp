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
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function getOptionalEnvVar(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}
