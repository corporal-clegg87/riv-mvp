import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EmailService, sendEmail, sendOTPEmail, getDeliveryStatus } from '../../src/lib/email';
import { isDevelopment, getOptionalEnvVar } from '../../src/lib/config';
import { getSecret } from '../../src/lib/secrets';

// Mock dependencies
vi.mock('../../src/lib/config', () => ({
  isDevelopment: vi.fn(),
  getRequiredEnvVar: vi.fn(),
  getOptionalEnvVar: vi.fn()
}));

vi.mock('../../src/lib/secrets', () => ({
  getSecret: vi.fn()
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
      verify: vi.fn()
    }))
  },
  createTransport: vi.fn(() => ({
    sendMail: vi.fn(),
    verify: vi.fn()
  }))
}));

describe('Email Service Integration Tests', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService();
  });

  describe('Development Mode Integration', () => {
    beforeEach(() => {
      vi.mocked(isDevelopment).mockReturnValue(true);
    });

    test('should send email and return email ID in development', async () => {
      const emailId = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Integration Test',
        text: 'This is an integration test email'
      });

      expect(emailId).toBeDefined();
      expect(typeof emailId).toBe('string');
      expect(emailId.length).toBeGreaterThan(0);
    });

    test('should track delivery status in development', async () => {
      const emailId = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Status Test',
        text: 'Testing delivery status tracking'
      });

      const status = emailService.getDeliveryStatus(emailId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('sent');
      expect(status?.to).toBe('test@example.com');
      expect(status?.subject).toBe('Status Test');
      expect(status?.attempts).toBe(1);
    });

    test('should send OTP email with proper tracking', async () => {
      const emailId = await emailService.sendOTPEmail('user@example.com', '123456');

      expect(emailId).toBeDefined();
      
      const status = emailService.getDeliveryStatus(emailId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('sent');
      expect(status?.to).toBe('user@example.com');
      expect(status?.subject).toBe('Your RIV Login Code');
    });
  });

  describe('Production Mode Integration', () => {
    beforeEach(() => {
      vi.mocked(isDevelopment).mockReturnValue(false);
      vi.mocked(getSecret).mockResolvedValue('test-secret');
      vi.mocked(getOptionalEnvVar).mockImplementation((name: string, defaultValue?: string) => {
        if (name === 'TENCENT_SES_SMTP_HOST') return 'smtp.tencentcloud.com';
        if (name === 'TENCENT_SES_SMTP_PORT') return '587';
        if (name === 'TENCENT_SES_FROM_EMAIL') return 'test@example.com';
        return defaultValue;
      });
    });

    test('should handle successful email sending in production', async () => {
      // Mock successful email sending
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
      const mockTransporter = {
        sendMail: mockSendMail,
        verify: vi.fn().mockResolvedValue(true)
      };
      
      vi.mocked(require('nodemailer').createTransport).mockReturnValue(mockTransporter);

      const emailId = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Production Test',
        text: 'This is a production test email'
      });

      expect(emailId).toBeDefined();
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'test@example.com',
        subject: 'Production Test',
        text: 'This is a production test email',
        html: undefined
      });

      // Check delivery status
      const status = emailService.getDeliveryStatus(emailId);
      expect(status?.status).toBe('sent');
    });

    test('should handle email sending failure with retry', async () => {
      // Mock email sending failure
      const mockSendMail = vi.fn()
        .mockRejectedValueOnce(new Error('SMTP connection failed'))
        .mockRejectedValueOnce(new Error('SMTP connection failed'))
        .mockResolvedValue({ messageId: 'test-message-id' });
      
      const mockTransporter = {
        sendMail: mockSendMail,
        verify: vi.fn().mockResolvedValue(true)
      };
      
      vi.mocked(require('nodemailer').createTransport).mockReturnValue(mockTransporter);

      const emailId = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Retry Test',
        text: 'Testing retry mechanism'
      });

      expect(emailId).toBeDefined();

      // Wait for retry to complete
      await new Promise(resolve => setTimeout(resolve, 6000));

      const status = emailService.getDeliveryStatus(emailId);
      expect(status?.status).toBe('sent');
      expect(status?.attempts).toBe(3);
    });

    test('should handle email sending failure after max retries', async () => {
      // Mock persistent email sending failure
      const mockSendMail = vi.fn().mockRejectedValue(new Error('Persistent SMTP failure'));
      const mockTransporter = {
        sendMail: mockSendMail,
        verify: vi.fn().mockResolvedValue(true)
      };
      
      vi.mocked(require('nodemailer').createTransport).mockReturnValue(mockTransporter);

      await expect(emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Failure Test',
        text: 'Testing failure handling'
      })).rejects.toThrow('Email sending failed after 3 attempts');
    });
  });

  describe('Rate Limiting Integration', () => {
    beforeEach(() => {
      vi.mocked(isDevelopment).mockReturnValue(true);
    });

    test('should enforce rate limiting across multiple emails', async () => {
      const identifier = 'test-user';
      
      // Send 5 emails (within limit)
      const emailIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const emailId = await emailService.sendEmail({
          to: 'test@example.com',
          subject: `Test ${i}`,
          text: `Test email ${i}`
        }, identifier);
        emailIds.push(emailId);
      }

      expect(emailIds).toHaveLength(5);

      // 6th email should be rate limited
      await expect(emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Rate Limited',
        text: 'This should be rate limited'
      }, identifier)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Delivery Status Management', () => {
    beforeEach(() => {
      vi.mocked(isDevelopment).mockReturnValue(true);
    });

    test('should track multiple email deliveries', async () => {
      const emailIds = await Promise.all([
        emailService.sendEmail({
          to: 'user1@example.com',
          subject: 'Email 1',
          text: 'First email'
        }),
        emailService.sendEmail({
          to: 'user2@example.com',
          subject: 'Email 2',
          text: 'Second email'
        }),
        emailService.sendOTPEmail('user3@example.com', '123456')
      ]);

      expect(emailIds).toHaveLength(3);

      const allStatuses = emailService.getAllDeliveryStatuses();
      expect(allStatuses).toHaveLength(3);
      
      allStatuses.forEach(status => {
        expect(status.status).toBe('sent');
        expect(status.attempts).toBe(1);
        expect(status.lastAttempt).toBeDefined();
      });
    });

    test('should provide delivery status by email ID', async () => {
      const emailId = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Status Test',
        text: 'Testing status retrieval'
      });

      const status = emailService.getDeliveryStatus(emailId);
      expect(status).toBeDefined();
      expect(status?.id).toBe(emailId);
      expect(status?.to).toBe('test@example.com');
      expect(status?.subject).toBe('Status Test');
    });
  });
});
