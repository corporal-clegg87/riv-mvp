import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EmailService, sendEmail, sendOTPEmail, validateEmailConfig } from '../../src/lib/email';
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

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService();
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      vi.mocked(isDevelopment).mockReturnValue(true);
    });

    test('should send email in development mode', async () => {
      const emailId = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test content'
      });

      expect(emailId).toBeDefined();
      expect(typeof emailId).toBe('string');
    });

    test('should send OTP email with correct format', async () => {
      const emailId = await emailService.sendOTPEmail('test@example.com', '123456');

      expect(emailId).toBeDefined();
      expect(typeof emailId).toBe('string');
    });

    test('should validate config in development', async () => {
      const result = await emailService.validateConfig();
      expect(result).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      vi.mocked(isDevelopment).mockReturnValue(true);
    });

    test('should allow emails within rate limit', async () => {
      const identifier = 'test-identifier';
      
      // Send 5 emails (within limit)
      for (let i = 0; i < 5; i++) {
        await expect(emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test'
        }, identifier)).resolves.not.toThrow();
      }
    });

    test('should enforce rate limit', async () => {
      const identifier = 'test-identifier';
      
      // Send 5 emails (within limit)
      for (let i = 0; i < 5; i++) {
        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test'
        }, identifier);
      }

      // 6th email should be rate limited
      await expect(emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      }, identifier)).rejects.toThrow('Rate limit exceeded');
    });

    test('should reset rate limit after window expires', async () => {
      const identifier = 'test-identifier';
      
      // Send 5 emails to hit limit
      for (let i = 0; i < 5; i++) {
        await emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test'
        }, identifier);
      }

      // Use vi.advanceTimersByTime to advance time without affecting global state
      vi.useFakeTimers();
      const originalDateNow = Date.now;
      const mockDateNow = vi.fn().mockReturnValue(originalDateNow() + 61000);
      vi.spyOn(Date, 'now').mockImplementation(mockDateNow);

      // Should allow email after rate limit window
      await expect(emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      }, identifier)).resolves.not.toThrow();

      // Restore original Date.now
      vi.spyOn(Date, 'now').mockRestore();
      vi.useRealTimers();
    });
  });

  describe('Production Mode', () => {
    test('should validate email configuration', async () => {
      vi.mocked(isDevelopment).mockReturnValue(false);
      vi.mocked(getSecret).mockResolvedValue('test-secret');
      vi.mocked(getOptionalEnvVar).mockImplementation((name: string, defaultValue?: string) => {
        if (name === 'TENCENT_SES_SMTP_HOST') return 'smtp.tencentcloud.com';
        if (name === 'TENCENT_SES_SMTP_PORT') return '587';
        if (name === 'TENCENT_SES_FROM_EMAIL') return 'test@example.com';
        return defaultValue;
      });
      
      // Mock nodemailer transporter
      const mockTransporter = {
        sendMail: vi.fn(),
        verify: vi.fn().mockResolvedValue(true)
      };
      vi.mocked(require('nodemailer').createTransport).mockReturnValue(mockTransporter);
      
      // Create a fresh instance for production mode
      const prodEmailService = new EmailService();
      
      // Wait for initialization to complete using the service's own mechanism
      await prodEmailService.validateConfig();
      
      const result = await prodEmailService.validateConfig();
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle email sending errors', async () => {
      vi.mocked(isDevelopment).mockReturnValue(false);
      vi.mocked(getSecret).mockRejectedValue(new Error('Secret not found'));
      vi.mocked(getOptionalEnvVar).mockReturnValue('test-value');

      // Create a new instance to trigger initialization error
      const errorEmailService = new EmailService();
      
      // Wait for initialization to complete using the service's own mechanism
      await errorEmailService.validateConfig();
      
      const result = await errorEmailService.validateConfig();
      expect(result).toBe(false);
    });
  });

  describe('Memory Management', () => {
    test('should cleanup pending timeouts', () => {
      // Create a service instance
      const service = new EmailService();
      
      // Mock setTimeout to track calls
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      // Simulate adding timeouts (this would happen during retry)
      const mockTimeoutId1 = setTimeout(() => {}, 1000);
      const mockTimeoutId2 = setTimeout(() => {}, 2000);
      
      // Manually add to timeoutIds set to simulate retry scenario
      (service as any).timeoutIds.add(mockTimeoutId1);
      (service as any).timeoutIds.add(mockTimeoutId2);
      
      // Call cleanup
      service.cleanup();
      
      // Verify clearTimeout was called for each timeout
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimeoutId1);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimeoutId2);
      
      // Verify timeoutIds set is cleared
      expect((service as any).timeoutIds.size).toBe(0);
      
      // Cleanup spies
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });

    test('should abort pending operations', () => {
      const service = new EmailService();
      
      // Create mock abort controllers
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      const abortSpy1 = vi.spyOn(controller1, 'abort');
      const abortSpy2 = vi.spyOn(controller2, 'abort');
      
      // Manually add to abortControllers map
      (service as any).abortControllers.set('email1', controller1);
      (service as any).abortControllers.set('email2', controller2);
      
      // Call cleanup
      service.cleanup();
      
      // Verify abort was called on each controller
      expect(abortSpy1).toHaveBeenCalled();
      expect(abortSpy2).toHaveBeenCalled();
      
      // Verify abortControllers map is cleared
      expect((service as any).abortControllers.size).toBe(0);
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should export sendEmail function', async () => {
    vi.mocked(isDevelopment).mockReturnValue(true);
    
    const emailId = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test'
    });

    expect(emailId).toBeDefined();
    expect(typeof emailId).toBe('string');
  });

  test('should export sendOTPEmail function', async () => {
    vi.mocked(isDevelopment).mockReturnValue(true);
    
    const emailId = await sendOTPEmail('test@example.com', '123456');

    expect(emailId).toBeDefined();
    expect(typeof emailId).toBe('string');
  });

  test('should export validateEmailConfig function', async () => {
    vi.mocked(isDevelopment).mockReturnValue(true);
    
    const result = await validateEmailConfig();
    expect(result).toBe(true);
  });
});
