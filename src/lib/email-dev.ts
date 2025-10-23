import { isDevelopment } from './config';
import { logger } from './logger';

export interface CapturedEmail {
  id: string;
  timestamp: Date;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailDevService {
  private capturedEmails: CapturedEmail[] = [];
  private maxCapturedEmails: number = 100;

  constructor() {
    if (!isDevelopment()) {
      throw new Error('EmailDevService can only be used in development environment');
    }
  }

  captureEmail(email: Omit<CapturedEmail, 'id' | 'timestamp'>): void {
    const capturedEmail: CapturedEmail = {
      id: `email_${Date.now()}_${crypto.randomUUID()}`,
      timestamp: new Date(),
      ...email
    };

    this.capturedEmails.unshift(capturedEmail);

    // Keep only the most recent emails
    if (this.capturedEmails.length > this.maxCapturedEmails) {
      this.capturedEmails = this.capturedEmails.slice(0, this.maxCapturedEmails);
    }

    logger.info('Email captured for development', {
      id: capturedEmail.id,
      to: capturedEmail.to,
      subject: capturedEmail.subject
    });
  }

  getCapturedEmails(): CapturedEmail[] {
    return [...this.capturedEmails];
  }

  getCapturedEmailById(id: string): CapturedEmail | undefined {
    return this.capturedEmails.find(email => email.id === id);
  }

  getCapturedEmailsByRecipient(to: string): CapturedEmail[] {
    return this.capturedEmails.filter(email => email.to === to);
  }

  clearCapturedEmails(): void {
    this.capturedEmails = [];
    logger.info('Cleared all captured emails');
  }

  getEmailStats(): { total: number; byRecipient: Record<string, number> } {
    const byRecipient: Record<string, number> = {};
    
    this.capturedEmails.forEach(email => {
      byRecipient[email.to] = (byRecipient[email.to] || 0) + 1;
    });

    return {
      total: this.capturedEmails.length,
      byRecipient
    };
  }
}

// Lazy singleton instance for development
let _emailDevService: EmailDevService | null = null;

function getEmailDevService(): EmailDevService {
  if (!_emailDevService) {
    _emailDevService = new EmailDevService();
  }
  return _emailDevService;
}

// Convenience functions
export function captureEmail(email: Omit<CapturedEmail, 'id' | 'timestamp'>): void {
  return getEmailDevService().captureEmail(email);
}

export function getCapturedEmails(): CapturedEmail[] {
  return getEmailDevService().getCapturedEmails();
}

export function clearCapturedEmails(): void {
  return getEmailDevService().clearCapturedEmails();
}
