// Basic type definitions for the application

export interface ProviderConfig {
  name: string
  baseUrl: string
  timeout: number
  features: string[]
}

export interface TestResult {
  success: boolean
  responseTime: number
  statusCode: number
  error?: string
}

export interface ConnectivityTest {
  name: string
  url: string
  expectedStatus: number
  timeout: number
}

export interface PerformanceMetrics {
  responseTime: number
  concurrentRequests: number
  successRate: number
  errorRate: number
}

