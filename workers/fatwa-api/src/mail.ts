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
const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
const LOGO = 'https://fatwa-admin.pages.dev/fatwa-icon.png';
export const welcomeMail = (name: string, provider = 'email') => {
  const n = esc(name.trim() || 'friend');
  const via = provider === 'google' ? 'with your Google account' : 'with your email';
  const items: Array<[string, string]> = [
    ['Ask a question', 'Send your question and receive an answer from qualified scholars.'],
    ['Read the library', 'Quran, hadith and fiqh references, searchable in one place.'],
    ['Ask Fatwa AI', 'Quick guidance grounded in the library, any time of day.'],
    ['Share with the community', 'Post useful reminders and read what your city is sharing.'],
  ];
  const rows = items.map(([t, d]) => `<tr><td style="padding:10px 0;border-top:1px solid #e9efe9"><div style="font-size:15px;font-weight:700;color:#12261d">${t}</div><div style="font-size:13px;line-height:19px;color:#5f7469;margin-top:2px">${d}</div></td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#eef2ee;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:22px;overflow:hidden">
<tr><td align="center" style="background:#0b3d26;background-image:linear-gradient(135deg,#0b3d26,#14804f);padding:36px 24px 30px">
<img src="${LOGO}" width="72" height="72" alt="Fatwa" style="border-radius:20px;border:2px solid #e6d3a3;display:block;margin:0 auto 16px">
<div style="color:#e6d3a3;font-size:13px;letter-spacing:3px;text-transform:uppercase">Welcome</div>
<div style="color:#ffffff;font-size:27px;font-weight:700;margin-top:6px">Assalamu alaikum, ${n}</div></td></tr>
<tr><td style="padding:28px 28px 8px"><p style="margin:0;font-size:15px;line-height:24px;color:#2b4034">Your Fatwa account is ready. You signed in ${via}, so everything you save, ask and share stays with you on every device.</p></td></tr>
<tr><td style="padding:10px 28px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td align="center" style="padding:20px 28px 8px"><div style="background:#f6f1e3;border-radius:14px;padding:14px 16px;color:#6b5a1f;font-size:13px;line-height:20px">Fatwa gives general guidance. For personal or complex matters, please ask a qualified scholar.</div></td></tr>
<tr><td style="padding:18px 28px 30px;font-size:13px;line-height:20px;color:#5f7469">Need help? Just reply to this email or write to <a href="mailto:contactfatwaapp@gmail.com" style="color:#0f5132;font-weight:700">contactfatwaapp@gmail.com</a>.<br><br>JazakAllahu khairan,<br><b style="color:#0f5132">The Fatwa team</b></td></tr>
</table>
<div style="font-size:11px;color:#8a9a90;margin-top:14px">You received this because you created a Fatwa account.</div>
</td></tr></table></body></html>`;
  return { subject: 'Welcome to Fatwa', text: `Assalamu alaikum ${name.trim() || 'friend'},\n\nYour Fatwa account is ready (signed in ${via}).\n\n- Ask a question and get an answer from qualified scholars\n- Read the Quran, hadith and fiqh library\n- Ask Fatwa AI for quick guidance\n- Share useful posts with your community\n\nNeed help? Reply to this email or write to contactfatwaapp@gmail.com.\n\nJazakAllahu khairan,\nThe Fatwa team`, html };
};
