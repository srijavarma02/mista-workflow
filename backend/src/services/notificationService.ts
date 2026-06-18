import nodemailer from 'nodemailer';
import { query } from '../config/database';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export interface NotifyPayload {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  channel?: 'in_app' | 'email' | 'whatsapp' | 'all';
  entityType?: string;
  entityId?: string;
  userEmail?: string;
}

export async function sendNotification(payload: NotifyPayload): Promise<void> {
  const channel = payload.channel || 'in_app';

  // Always save in-app notification
  await query(
    `INSERT INTO notifications (user_id, title, message, type, channel, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      payload.userId,
      payload.title,
      payload.message,
      payload.type,
      channel,
      payload.entityType || null,
      payload.entityId || null,
    ]
  );

  // Email channel
  if ((channel === 'email' || channel === 'all') && payload.userEmail) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: payload.userEmail,
        subject: payload.title,
        html: `<div style="font-family:sans-serif;padding:20px">
          <h2 style="color:#1e40af">${payload.title}</h2>
          <p>${payload.message}</p>
          <hr/>
          <small>Stores & Inventory Management System</small>
        </div>`,
      });
    } catch (err) {
      console.error('Email send error:', err);
    }
  }
}

export async function notifyRole(
  role: string,
  payload: Omit<NotifyPayload, 'userId' | 'userEmail'>
): Promise<void> {
  const users = await query<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE role = $1 AND is_active = true',
    [role]
  );

  await Promise.all(
    users.rows.map((u) =>
      sendNotification({ ...payload, userId: u.id, userEmail: u.email })
    )
  );
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}
