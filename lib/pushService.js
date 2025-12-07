import admin from 'firebase-admin';
import webpush from 'web-push';
import { db } from './firebase.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const PUSH_SENDER_EMAIL = process.env.PUSH_SENDER_EMAIL || 'notifications@steeb.app';
const PUSH_TIMEZONE = process.env.PUSH_TIMEZONE || 'America/Argentina/Buenos_Aires';
const PUSH_DAILY_HOUR = Number(process.env.PUSH_DAILY_HOUR || 10);
const PUSH_DAILY_MINUTE = Number(process.env.PUSH_DAILY_MINUTE || 0);
const PUSH_TEST_SECRET = process.env.PUSH_TEST_SECRET || '';

const PUSH_COLLECTION = 'push_subscriptions';
let lastDailySentKey = null;

const DAILY_MESSAGES = [
  'Buenos dias! STEEB aqui. Es momento de hacer que este dia cuente.',
  'Nuevo dia, nuevas oportunidades. Que vas a lograr hoy?',
  'La innovacion distingue entre un lider y un seguidor. Lidera tu dia!',
  'Tu tiempo es limitado, no lo desperdicies. Haz que importe!',
  'La calidad nunca es un accidente. Haz todo con excelencia hoy!'
];

const isPushConfigured = () => Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isPushConfigured()) {
  webpush.setVapidDetails(`mailto:${PUSH_SENDER_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('Web Push configurado con VAPID');
} else {
  console.warn('Web Push deshabilitado: faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY');
}

const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const getSubscriptionId = (endpoint) => Buffer.from(endpoint).toString('base64');

export const saveSubscription = async (subscription, metadata = {}) => {
  if (!isPushConfigured()) {
    throw new Error('Web Push no esta configurado en el backend');
  }

  if (!subscription?.endpoint) {
    throw new Error('Suscripcion invalida: falta endpoint');
  }

  const id = getSubscriptionId(subscription.endpoint);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection(PUSH_COLLECTION).doc(id).set(
    {
      subscription,
      metadata,
      updatedAt: now,
      createdAt: now
    },
    { merge: true }
  );

  return id;
};

const removeSubscription = async (endpoint) => {
  const id = getSubscriptionId(endpoint);
  await db.collection(PUSH_COLLECTION).doc(id).delete();
};

export const sendPushToSubscription = async (subscription, payload) => {
  if (!isPushConfigured()) return false;

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    const status = error?.statusCode;
    if (status === 404 || status === 410) {
      console.warn('Suscripcion expirada, se elimina:', subscription.endpoint);
      await removeSubscription(subscription.endpoint);
    } else {
      console.error('Error enviando push:', error.message || error);
    }
    return false;
  }
};

export const sendPushToAll = async (payload) => {
  if (!isPushConfigured()) {
    return { sent: 0, total: 0, error: 'Web Push no configurado' };
  }

  const snapshot = await db.collection(PUSH_COLLECTION).get();
  let sent = 0;
  let total = snapshot.size;

  for (const doc of snapshot.docs) {
    const sub = doc.data().subscription;
    const ok = await sendPushToSubscription(sub, payload);
    if (ok) sent += 1;
  }

  return { sent, total };
};

const shouldSendDailyNow = (now = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PUSH_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  const [hourStr, minuteStr] = formatter.format(now).split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  // If the server was restarted after the scheduled time, we still want to send
  // the daily push once for the current day. This prevents missing reminders
  // when the server isn't running exactly at the scheduled minute.
  if (hour > PUSH_DAILY_HOUR) return true;
  if (hour === PUSH_DAILY_HOUR && minute >= PUSH_DAILY_MINUTE) return true;
  return false;
};

export const sendDailyMotivationPush = async () => {
  const message = DAILY_MESSAGES[Math.floor(Math.random() * DAILY_MESSAGES.length)];
  const payload = {
    title: 'STEEB - Buenos dias',
    body: message,
    tag: 'daily-motivation',
    data: { url: '/' }
  };

  return sendPushToAll(payload);
};

export const startDailyPushScheduler = () => {
  if (!isPushConfigured()) return;

  const checkAndSend = async () => {
    try {
      const now = new Date();
      const todayKey = getDateKey(now);

      if (lastDailySentKey === todayKey) return;
      if (!shouldSendDailyNow(now)) return;

      const result = await sendDailyMotivationPush();
      if (result.sent > 0) {
        lastDailySentKey = todayKey;
        console.log(`Push diario enviado a ${result.sent}/${result.total} suscriptores`);
      } else {
        console.warn('No se envio ningun push diario (0 suscriptores?)');
      }
    } catch (error) {
      console.error('Error en scheduler de push diario:', error);
    }
  };

  // Ejecutar al inicio y luego cada minuto
  checkAndSend();
  setInterval(checkAndSend, 60 * 1000);
};

export const sendTestPush = async (title = 'STEEB test', body = 'Push de prueba') => {
  const payload = {
    title,
    body,
    tag: 'test-push',
    data: { url: '/' }
  };
  return sendPushToAll(payload);
};

export const validatePushSecret = (providedSecret) => {
  if (!PUSH_TEST_SECRET) return true; // open if no secret set
  return providedSecret === PUSH_TEST_SECRET;
};

export const pushIsConfigured = isPushConfigured;
