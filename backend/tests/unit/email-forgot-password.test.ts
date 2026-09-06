import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { processEmailJob } from '../../src/workers/email.worker.js';
import { cacheService } from '../../src/services/cache/index.js';
import { AuthService } from '../../src/modules/auth/service.js';
import { AppError } from '../../src/middleware/errorHandler.middleware.js';
import env from '../../src/config/env.js';

describe('Email Worker & Forgot Password Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('processEmailJob', () => {
    it('should process OTP_FORGOT_PASSWORD email job and log OTP in test/dev environment', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await processEmailJob({
        to: 'chef@restaurant.com',
        subject: 'Password Reset Verification Code',
        template: 'OTP_FORGOT_PASSWORD',
        context: { otp: '654321' },
      });

      // Verify OTP was logged to console for easy developer testing
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔑 [DEV EMAIL OTP]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('654321'));
    });

    it('should send email via Nodemailer when SMTP credentials are present', async () => {
      const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg-mock-123' });
      const { setNodemailerTransporterForTest } = await import('../../src/workers/email.worker.js');
      setNodemailerTransporterForTest({
        sendMail: sendMailMock,
      } as any);

      try {
        await processEmailJob({
          to: 'test@domain.com',
          subject: 'Your OTP Code',
          template: 'OTP_FORGOT_PASSWORD',
          context: { otp: '998877' },
        });

        expect(sendMailMock).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'test@domain.com',
            subject: 'Your OTP Code',
            html: expect.stringContaining('998877'),
          })
        );
      } finally {
        setNodemailerTransporterForTest(null);
      }
    });
  });

  describe('AuthService OTP Verification & Reset', () => {
    const testEmail = 'reset-user@example.com';
    const testOtp = '482910';

    beforeEach(async () => {
      const otpKey = `otp:forgot:${testEmail}`;
      await cacheService.set(otpKey, { otp: testOtp, tenantId: 'tenant-123', userId: 'user-123' }, 600);
    });

    it('should reject invalid or expired OTP code', async () => {
      await expect(
        AuthService.verifyOtp({ email: testEmail, otp: '000000' })
      ).rejects.toThrow(AppError);
    });

    it('should verify correct OTP code, clear OTP, and return a resetToken', async () => {
      const result = await AuthService.verifyOtp({ email: testEmail, otp: testOtp });
      expect(result).toHaveProperty('resetToken');
      expect(typeof result.resetToken).toBe('string');

      // OTP should be cleared after single use
      const cached = await cacheService.get(`otp:forgot:${testEmail}`);
      expect(cached).toBeNull();

      // Reset token should exist in cache
      const resetTokenRecord = await cacheService.get<{ userId: string }>(`reset_token:${result.resetToken}`);
      expect(resetTokenRecord).toEqual({ userId: 'user-123' });
    });
  });
});
