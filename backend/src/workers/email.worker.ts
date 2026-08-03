import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

export type EmailTemplateType = 'WELCOME' | 'OTP_FORGOT_PASSWORD' | 'GENERAL';

export interface EmailJobPayload {
  to: string;
  subject: string;
  template: EmailTemplateType | string;
  context: Record<string, unknown>;
  tenantId?: string;
}

// Initialize Nodemailer SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env['SMTP_HOST'] || 'smtp.example.com',
  port: Number(process.env['SMTP_PORT'] || 587),
  secure: process.env['SMTP_SECURE'] === 'true',
  auth: {
    user: process.env['SMTP_USER'] || '',
    pass: process.env['SMTP_PASS'] || '',
  },
});

function generateHtmlContent(template: string, context: Record<string, unknown>): string {
  if (template === 'WELCOME') {
    const name = (context['name'] as string) || 'Valued Partner';
    const restaurant = (context['restaurantName'] as string) || 'your restaurant';
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; text-align: center;">Welcome to our Restaurant SaaS Platform! 🎉</h2>
        <p style="font-size: 16px; color: #334155;">Hello <strong>${name}</strong>,</p>
        <p style="font-size: 16px; color: #334155;">We are thrilled to welcome <strong>${restaurant}</strong> to our cloud POS and intelligent restaurant ecosystem.</p>
        <p style="font-size: 14px; color: #64748b; margin-top: 30px;">Get ready to manage menus, orders, tables, and AI-powered customer support seamlessly.</p>
      </div>
    `;
  }

  if (template === 'OTP_FORGOT_PASSWORD') {
    const otp = (context['otp'] as string) || '123456';
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
        <h2 style="color: #dc2626; text-align: center;">Password Reset Verification</h2>
        <p style="font-size: 16px; color: #334155;">You requested to reset your password. Use the verification code below:</p>
        <div style="text-align: center; margin: 25px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; background-color: #fee2e2; color: #b91c1c; padding: 10px 20px; border-radius: 8px; border: 1px dashed #f87171;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #94a3b8;">This code expires in 10 minutes. If you didn't request this reset, simply ignore this email.</p>
      </div>
    `;
  }

  return `<p>${String(context['message'] || 'No additional details provided.')}</p>`;
}

export async function processEmailJob(payload: EmailJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId || 'global';
  const html = generateHtmlContent(payload.template, payload.context);

  logger.info({ tenantId, to: payload.to, subject: payload.subject, template: payload.template }, 'Processing async email delivery job');

  // If SMTP is not fully configured in local dev/test environment, log simulation cleanly instead of failing
  if (!process.env['SMTP_USER'] || process.env['NODE_ENV'] === 'test') {
    logger.info({ to: payload.to, subject: payload.subject }, 'SMTP credentials unconfigured or test mode — email delivery simulated successfully');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env['SMTP_FROM'] || '"Restaurant SaaS Platform" <no-reply@saas-restaurant.com>',
      to: payload.to,
      subject: payload.subject,
      html,
    });
    logger.info({ to: payload.to, tenantId }, 'Email successfully transmitted via Nodemailer SMTP');
  } catch (error) {
    logger.error({ tenantId, to: payload.to, error }, 'Nodemailer SMTP transmission encountered an error');
    throw error; // Rethrow so QStash queue consumer can evaluate retry limits
  }
}
