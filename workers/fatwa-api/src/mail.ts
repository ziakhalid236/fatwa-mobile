// Minimal SMTP client (implicit TLS, port 465) for Gmail with an app password. Falls back to Resend.
import { connect } from 'cloudflare:sockets';

export interface MailEnv { SMTP_USER?: string; SMTP_PASS?: string; SMTP_HOST?: string; RESEND_API_KEY?: string; MAIL_FROM?: string }
export const mailEnabled = (env: MailEnv) => Boolean((env.SMTP_USER && env.SMTP_PASS) || env.RESEND_API_KEY);

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const header = (s: string) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;

async function smtpSend(env: MailEnv, to: string, subject: string, text: string, html?: string) {
  const socket = connect({ hostname: env.SMTP_HOST || 'smtp.gmail.com', port: 465 }, { secureTransport: 'on', allowHalfOpen: false });
  const writer = socket.writable.getWriter(); const reader = socket.readable.getReader();
  const dec = new TextDecoder(); const enc = new TextEncoder(); let buf = '';
  const read = async (): Promise<string> => {
    for (;;) {
      const lines = buf.split('\r\n');
      const last = lines.length > 1 ? lines[lines.length - 2] : '';
      if (last && /^\d{3} /.test(last)) { const out = buf; buf = ''; return out; }
      const { value, done } = await reader.read(); if (done) throw new Error('smtp_closed');
      buf += dec.decode(value);
    }
  };
  const expect = async (code: number) => { const r = await read(); if (!r.startsWith(String(code)) && !r.split('\r\n').some((l) => l.startsWith(`${code} `))) throw new Error(`smtp_${r.slice(0, 80).trim()}`); };
  const cmd = async (line: string, code: number) => { await writer.write(enc.encode(line + '\r\n')); await expect(code); };
  try {
    await expect(220); await cmd('EHLO fatwa.app', 250);
    await cmd('AUTH LOGIN', 334); await cmd(b64(env.SMTP_USER!), 334); await cmd(b64(env.SMTP_PASS!.replace(/\s+/g, '')), 235);
    await cmd(`MAIL FROM:<${env.SMTP_USER}>`, 250); await cmd(`RCPT TO:<${to}>`, 250); await cmd('DATA', 354);
    const boundary = `b${crypto.randomUUID().replace(/-/g, '')}`;
    const parts = [`--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text).replace(/(.{76})/g, '$1\r\n')];
    if (html) parts.push(`--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html).replace(/(.{76})/g, '$1\r\n'));
    parts.push(`--${boundary}--`);
    const msg = [`From: Fatwa App <${env.SMTP_USER}>`, `To: ${to}`, `Subject: ${header(subject)}`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, `Date: ${new Date().toUTCString()}`, '', ...parts, '.'].join('\r\n');
    await cmd(msg, 250);
    await writer.write(enc.encode('QUIT\r\n'));
  } finally { try { await socket.close(); } catch { /* ignore */ } }
}

export async function sendMail(env: MailEnv, to: string, subject: string, text: string, html?: string) {
  if (env.SMTP_USER && env.SMTP_PASS) return smtpSend(env, to, subject, text, html);
  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM || 'Fatwa <onboarding@resend.dev>', to: [to], subject, text, html }) });
    if (!r.ok) throw new Error('resend_failed');
    return;
  }
  throw new Error('mail_not_configured');
}

const card = (title: string, body: string) => `<div style="font-family:Arial,sans-serif;background:#f4f1ea;padding:24px"><div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;padding:28px;border-top:5px solid #0f5132"><h2 style="margin:0 0 12px;color:#0f5132">${title}</h2>${body}<p style="color:#888;font-size:12px;margin-top:24px">Fatwa App · contactfatwaapp@gmail.com</p></div></div>`;
export const otpMail = (code: string) => ({ subject: `Your Fatwa code: ${code}`, text: `Your Fatwa sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`, html: card('Sign in to Fatwa', `<p>Your verification code:</p><p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#0f5132">${code}</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`) });
export const welcomeMail = (name: string) => ({ subject: 'Welcome to Fatwa', text: `Assalamu alaikum ${name},\n\nWelcome to the Fatwa app. Ask questions, read the library and share useful posts with the community.\n\nNeed help? Reply to this email or write to contactfatwaapp@gmail.com.`, html: card(`Assalamu alaikum ${name.replace(/[<>&]/g, '')}`, '<p>Welcome to the Fatwa app. Ask questions, read the library of Quran, hadith and fiqh, and share useful posts with the community.</p><p>Need help? Reply to this email.</p>') });
