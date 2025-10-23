import nodemailer from 'nodemailer';
import { isDevelopment, getRequiredEnvVar, getOptionalEnvVar } from './config';
import { getSecret } from './secrets';
import { logger } from './logger';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailDeliveryStatus {
  id: string;
  to: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  retryAfter?: Date;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();
  private deliveryStatusMap: Map<string, EmailDeliveryStatus> = new Map();
  private timeoutIds: Set<NodeJS.Timeout> = new Set();
  private abortControllers: Map<string, AbortController> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly RATE_LIMIT_MAX = 5; // 5 emails per minute
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds
  private initialized: boolean = false;

  constructor() {
    // Initialize config asynchronously
    this.initializeConfig().catch(error => {
      console.error('Failed to initialize email service:', error);
    });
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  private async initializeConfig(): Promise<void> {
    if (isDevelopment()) {
      // Development: Use console logging
      this.config = null;
      this.initialized = true;
      return;
    }

    // Production: Use Tencent SES
    try {
      const host = getOptionalEnvVar('TENCENT_SES_SMTP_HOST', 'smtp.tencentcloud.com');
      const port = parseInt(getOptionalEnvVar('TENCENT_SES_SMTP_PORT', '587'));
      const username = await getSecret('TENCENT_SES_SMTP_USERNAME');
      const password = await getSecret('TENCENT_SES_SMTP_PASSWORD');
      const from = getOptionalEnvVar('TENCENT_SES_FROM_EMAIL');

      if (!username || !password || !from) {
        throw new Error('Missing required email configuration');
      }

      this.config = {
        host,
        port,
        secure: port === 465,
        auth: { user: username, pass: password },
        from
      };

      this.transporter = nodemailer.createTransport(this.config);
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize email service', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, error instanceof Error ? error : undefined);
      this.initialized = false;
      throw new Error(`Email service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    
    // Clean up expired entries to prevent memory leaks
    this.cleanupExpiredRateLimitEntries(now);
    
    const entry = this.rateLimitMap.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }

    if (entry.count >= this.RATE_LIMIT_MAX) {
      return false; // Rate limit exceeded
    }

    entry.count++;
    return true;
  }

  private cleanupExpiredRateLimitEntries(now: number): void {
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Wait for initialization to complete with timeout
    const maxWaitTime = 5000; // 5 seconds
    const startTime = Date.now();
    
    while (!this.initialized && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.initialized) {
      throw new Error('Email service initialization timeout');
    }
  }

  async sendEmail(options: EmailOptions, identifier?: string): Promise<string> {
    // Wait for initialization to complete
    await this.ensureInitialized();
    
    // Check rate limit if identifier provided
    if (identifier && !this.checkRateLimit(identifier)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    const emailId = crypto.randomUUID();
    const deliveryStatus: EmailDeliveryStatus = {
      id: emailId,
      to: options.to,
      subject: options.subject,
      status: 'pending',
      attempts: 0
    };
    this.deliveryStatusMap.set(emailId, deliveryStatus);

    if (isDevelopment()) {
      // Development: Log to structured logger
      logger.info('Email sent (Development Mode)', {
        emailId,
        to: options.to,
        subject: options.subject,
        hasText: !!options.text,
        hasHtml: !!options.html
      });
      deliveryStatus.status = 'sent';
      deliveryStatus.attempts = 1;
      deliveryStatus.lastAttempt = new Date();
      return emailId;
    }

    // Production: Send real email with retry logic
    return this.sendEmailWithRetry(emailId, options);
  }

  private async sendEmailWithRetry(emailId: string, options: EmailOptions): Promise<string> {
    const deliveryStatus = this.deliveryStatusMap.get(emailId);
    if (!deliveryStatus) {
      throw new Error('Email delivery status not found');
    }

    if (!this.transporter || !this.config) {
      throw new Error('Email service not properly initialized');
    }

    deliveryStatus.status = 'retrying';
    deliveryStatus.attempts++;
    deliveryStatus.lastAttempt = new Date();

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      });

      deliveryStatus.status = 'sent';
      logger.info('Email sent successfully', {
        emailId,
        to: options.to,
        subject: options.subject,
        attempts: deliveryStatus.attempts
      });
      return emailId;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      deliveryStatus.error = errorMessage;

      if (deliveryStatus.attempts < this.MAX_RETRY_ATTEMPTS) {
        deliveryStatus.retryAfter = new Date(Date.now() + this.RETRY_DELAY);
        logger.warn('Email sending failed, will retry', {
          emailId,
          to: options.to,
          subject: options.subject,
          attempts: deliveryStatus.attempts,
          maxAttempts: this.MAX_RETRY_ATTEMPTS,
          retryAfter: deliveryStatus.retryAfter,
          error: errorMessage
        });

        // Schedule retry with timeout tracking
        const timeoutId = setTimeout(() => {
          this.timeoutIds.delete(timeoutId);
          this.sendEmailWithRetry(emailId, options).catch(err => {
            logger.error('Retry failed', { emailId, error: err.message });
          });
        }, this.RETRY_DELAY);
        this.timeoutIds.add(timeoutId);

        return emailId;
      } else {
        deliveryStatus.status = 'failed';
        logger.error('Email sending failed after all retries', {
          emailId,
          to: options.to,
          subject: options.subject,
          attempts: deliveryStatus.attempts,
          error: errorMessage
        });
        throw new Error(`Email sending failed after ${this.MAX_RETRY_ATTEMPTS} attempts: ${errorMessage}`);
      }
    }
  }

  async sendOTPEmail(to: string, otp: string, identifier?: string): Promise<string> {
    const subject = 'Your RIV Login Code';
    const text = `Your login code is: ${otp}\n\nThis code will expire in 10 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your RIV Login Code</h2>
        <p>Your login code is: <strong style="font-size: 24px; color: #2563eb;">${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, text, html }, identifier);
  }

  async validateConfig(): Promise<boolean> {
    if (isDevelopment()) {
      return true; // Always valid in development
    }

    if (!this.initialized || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email configuration validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error ? error : undefined);
      return false;
    }
  }

  getDeliveryStatus(emailId: string): EmailDeliveryStatus | undefined {
    this.cleanupOldDeliveryStatuses();
    return this.deliveryStatusMap.get(emailId);
  }

  getAllDeliveryStatuses(): EmailDeliveryStatus[] {
    return Array.from(this.deliveryStatusMap.values());
  }

  private cleanupOldDeliveryStatuses(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [emailId, status] of this.deliveryStatusMap.entries()) {
      if (status.lastAttempt && (now - status.lastAttempt.getTime()) > maxAge) {
        this.deliveryStatusMap.delete(emailId);
      }
    }
  }

  private startPeriodicCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.cleanupExpiredRateLimitEntries(now);
      this.cleanupOldDeliveryStatuses();
    }, 5 * 60 * 1000);
  }

  /**
   * Cleanup method to clear all pending timeouts and abort controllers
   * Prevents memory leaks when service is destroyed
   */
  cleanup(): void {
    // Clear all pending timeouts
    for (const timeoutId of this.timeoutIds) {
      clearTimeout(timeoutId);
    }
    this.timeoutIds.clear();

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Abort all pending operations
    for (const [emailId, controller] of this.abortControllers.entries()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.deliveryStatusMap.clear();
  }
}

// Singleton instance
export const emailService = new EmailService();

// Convenience functions
export async function sendEmail(options: EmailOptions, identifier?: string): Promise<string> {
  return emailService.sendEmail(options, identifier);
}

export async function sendOTPEmail(to: string, otp: string, identifier?: string): Promise<string> {
  return emailService.sendOTPEmail(to, otp, identifier);
}

export async function validateEmailConfig(): Promise<boolean> {
  return emailService.validateConfig();
}

export function getDeliveryStatus(emailId: string): EmailDeliveryStatus | undefined {
  return emailService.getDeliveryStatus(emailId);
}

export function getAllDeliveryStatuses(): EmailDeliveryStatus[] {
  return emailService.getAllDeliveryStatuses();
}
