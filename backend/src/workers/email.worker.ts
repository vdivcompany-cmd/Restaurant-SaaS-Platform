import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';
import logger from '../utils/logger.js';
import env from '../config/env.js';

export type EmailTemplateType = 'WELCOME' | 'OTP_FORGOT_PASSWORD' | 'GENERAL';

export interface EmailJobPayload {
  to: string;
  subject: string;
  template: EmailTemplateType | string;
  context: Record<string, unknown>;
  tenantId?: string;
}

let _nodemailerTransporter: Transporter | null = null;

function getNodemailerTransporter(): Transporter | null {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  if (_nodemailerTransporter) {
    return _nodemailerTransporter;
  }
  _nodemailerTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return _nodemailerTransporter;
}

export function setNodemailerTransporterForTest(transporter: Transporter | null): void {
  _nodemailerTransporter = transporter;
}

function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(env.RESEND_API_KEY);
}

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

  // If OTP template, log directly to console in development / test mode for instant developer visibility
  if (payload.template === 'OTP_FORGOT_PASSWORD' && (env.NODE_ENV === 'development' || env.NODE_ENV === 'test')) {
    const otpCode = String(payload.context['otp'] || '');
    console.log('\n================================================================');
    console.log(`🔑 [DEV EMAIL OTP] Password Reset Verification Code for: ${payload.to}`);
    console.log(`👉 OTP CODE: ${otpCode}`);
    console.log('================================================================\n');
  }

  // ─── Provider 1: Nodemailer SMTP (Gmail, Hostinger, Outlook, or Custom SMTP) ─
  const transporter = getNodemailerTransporter();
  if (transporter) {
    try {
      const fromAddress = env.SMTP_FROM || env.SMTP_USER;
      const info = await transporter.sendMail({
        from: fromAddress,
        to: payload.to,
        subject: payload.subject,
        html,
      });
      logger.info({ to: payload.to, tenantId, messageId: info.messageId }, 'Email successfully transmitted via Nodemailer SMTP');
      return;
    } catch (smtpErr: any) {
      logger.error({ tenantId, to: payload.to, error: smtpErr?.message ?? smtpErr }, 'Nodemailer SMTP delivery failed');
      // If Resend is also configured, allow falling back to Resend; otherwise rethrow
      if (!env.RESEND_API_KEY) {
        throw new Error(`Nodemailer SMTP delivery failed: ${smtpErr?.message ?? smtpErr}`);
      }
    }
  }

  // ─── Provider 2: Resend Cloud API ──────────────────────────────────────────
  const resend = getResendClient();
  if (resend && env.NODE_ENV !== 'test') {
    try {
      const response = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html,
      });

      if (response.error) {
        logger.error({ tenantId, to: payload.to, error: response.error }, 'Resend API returned an error');
        throw new Error(`Resend email delivery failed: ${response.error.message}`);
      }

      logger.info({ to: payload.to, tenantId, emailId: response.data?.id }, 'Email successfully transmitted via Resend API');
      return;
    } catch (error) {
      logger.error({ tenantId, to: payload.to, error }, 'Resend transmission encountered an error');
      throw error;
    }
  }

  // ─── Simulation Fallback ───────────────────────────────────────────────────
  logger.info({ to: payload.to, subject: payload.subject }, 'No active SMTP or Resend credentials configured — email delivery simulated successfully');
}
