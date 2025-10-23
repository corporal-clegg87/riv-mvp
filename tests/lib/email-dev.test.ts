import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EmailDevService, captureEmail, getCapturedEmails, clearCapturedEmails } from '../../src/lib/email-dev';
import { isDevelopment } from '../../src/lib/config';

// Mock dependencies
vi.mock('../../src/lib/config', () => ({
  isDevelopment: vi.fn()
}));

describe('EmailDevService', () => {
  let emailDevService: EmailDevService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDevelopment).mockReturnValue(true);
    emailDevService = new EmailDevService();
  });

  describe('Development Environment Check', () => {
    test('should throw error when used in production', () => {
      vi.mocked(isDevelopment).mockReturnValue(false);
      
      expect(() => new EmailDevService()).toThrow('EmailDevService can only be used in development environment');
    });
  });

  describe('Email Capture', () => {
    test('should capture emails in development', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      emailDevService.captureEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test content'
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Email captured for development'));
      consoleSpy.mockRestore();
    });

    test('should generate unique IDs for captured emails', () => {
      emailDevService.captureEmail({
        to: 'test1@example.com',
        subject: 'Test 1',
        text: 'Content 1'
      });

      emailDevService.captureEmail({
        to: 'test2@example.com',
        subject: 'Test 2',
        text: 'Content 2'
      });

      const emails = emailDevService.getCapturedEmails();
      expect(emails).toHaveLength(2);
      expect(emails[0].id).not.toBe(emails[1].id);
    });

    test('should add timestamps to captured emails', () => {
      const beforeCapture = new Date();
      
      emailDevService.captureEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      });

      const afterCapture = new Date();
      const emails = emailDevService.getCapturedEmails();
      
      expect(emails[0].timestamp).toBeInstanceOf(Date);
      expect(emails[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeCapture.getTime());
      expect(emails[0].timestamp.getTime()).toBeLessThanOrEqual(afterCapture.getTime());
    });
  });

  describe('Email Retrieval', () => {
    beforeEach(() => {
      // Add some test emails
      emailDevService.captureEmail({
        to: 'user1@example.com',
        subject: 'Email 1',
        text: 'Content 1'
      });
      emailDevService.captureEmail({
        to: 'user2@example.com',
        subject: 'Email 2',
        text: 'Content 2'
      });
      emailDevService.captureEmail({
        to: 'user1@example.com',
        subject: 'Email 3',
        text: 'Content 3'
      });
    });

    test('should retrieve all captured emails', () => {
      const emails = emailDevService.getCapturedEmails();
      expect(emails).toHaveLength(3);
    });

    test('should retrieve emails by ID', () => {
      const emails = emailDevService.getCapturedEmails();
      const firstEmail = emails[0];
      
      const retrievedEmail = emailDevService.getCapturedEmailById(firstEmail.id);
      expect(retrievedEmail).toEqual(firstEmail);
    });

    test('should return undefined for non-existent ID', () => {
      const retrievedEmail = emailDevService.getCapturedEmailById('non-existent-id');
      expect(retrievedEmail).toBeUndefined();
    });

    test('should retrieve emails by recipient', () => {
      const user1Emails = emailDevService.getCapturedEmailsByRecipient('user1@example.com');
      expect(user1Emails).toHaveLength(2);
      expect(user1Emails.every(email => email.to === 'user1@example.com')).toBe(true);

      const user2Emails = emailDevService.getCapturedEmailsByRecipient('user2@example.com');
      expect(user2Emails).toHaveLength(1);
      expect(user2Emails[0].to).toBe('user2@example.com');
    });
  });

  describe('Email Management', () => {
    test('should clear captured emails', () => {
      // Add some emails
      emailDevService.captureEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      });

      expect(emailDevService.getCapturedEmails()).toHaveLength(1);

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      emailDevService.clearCapturedEmails();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared all captured emails'));
      expect(emailDevService.getCapturedEmails()).toHaveLength(0);
      
      consoleSpy.mockRestore();
    });

    test('should limit captured emails to max count', () => {
      // Add more emails than the max (100)
      for (let i = 0; i < 105; i++) {
        emailDevService.captureEmail({
          to: `test${i}@example.com`,
          subject: `Test ${i}`,
          text: `Content ${i}`
        });
      }

      const emails = emailDevService.getCapturedEmails();
      expect(emails).toHaveLength(100); // Should be limited to maxCapturedEmails
    });
  });

  describe('Email Statistics', () => {
    test('should provide email statistics', () => {
      // Add emails from different recipients
      emailDevService.captureEmail({
        to: 'user1@example.com',
        subject: 'Email 1',
        text: 'Content 1'
      });
      emailDevService.captureEmail({
        to: 'user2@example.com',
        subject: 'Email 2',
        text: 'Content 2'
      });
      emailDevService.captureEmail({
        to: 'user1@example.com',
        subject: 'Email 3',
        text: 'Content 3'
      });

      const stats = emailDevService.getEmailStats();
      
      expect(stats.total).toBe(3);
      expect(stats.byRecipient['user1@example.com']).toBe(2);
      expect(stats.byRecipient['user2@example.com']).toBe(1);
    });

    test('should handle empty email list', () => {
      const stats = emailDevService.getEmailStats();
      
      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byRecipient)).toHaveLength(0);
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDevelopment).mockReturnValue(true);
  });

  test('should export captureEmail function', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    captureEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test'
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should export getCapturedEmails function', () => {
    const emails = getCapturedEmails();
    expect(Array.isArray(emails)).toBe(true);
  });

  test('should export clearCapturedEmails function', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    clearCapturedEmails();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared all captured emails'));
    consoleSpy.mockRestore();
  });
});
