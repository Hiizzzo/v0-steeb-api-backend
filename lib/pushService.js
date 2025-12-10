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
const ADAPTIVE_MIN_EVENTS = 3;
const ADAPTIVE_PROBE_HOURS = [9, 11, 13, 16, 19, 21];

const PUSH_COLLECTION = 'push_subscriptions';
const PUSH_ENGAGEMENT_COLLECTION = 'push_engagement';
let lastDailySentKey = null;
const lastDailySentPerSubscription = new Map();

export const getPublicPushConfig = () => ({
  enabled: isPushConfigured(),
  vapidPublicKey: VAPID_PUBLIC_KEY || null,
  senderEmail: PUSH_SENDER_EMAIL,
  timezone: PUSH_TIMEZONE,
  dailyHour: PUSH_DAILY_HOUR,
  dailyMinute: PUSH_DAILY_MINUTE
});

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

const getTimezoneDateParts = (timezone = PUSH_TIMEZONE, date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const [month, day, year, hour, minute] = formatter
    .formatToParts(date)
    .filter(({ type }) => ['month', 'day', 'year', 'hour', 'minute'].includes(type))
    .map(({ value }) => value);

  return {
    hour: Number(hour),
    minute: Number(minute),
    dateKey: `${year}-${month}-${day}`
  };
};

const getDaysBetween = (start, end = new Date()) => {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
};

const getExplorationHour = (createdAt, dateForCalc = new Date()) => {
  if (!createdAt) return PUSH_DAILY_HOUR;
  const daysSinceStart = getDaysBetween(createdAt, dateForCalc);
  const index = daysSinceStart % ADAPTIVE_PROBE_HOURS.length;
  return ADAPTIVE_PROBE_HOURS[index];
};

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

const getEngagementProfile = async (userId) => {
  if (!userId) return null;
  const doc = await db.collection(PUSH_ENGAGEMENT_COLLECTION).doc(userId).get();
  if (!doc.exists) return null;
  return doc.data();
};

const determineBestHourForUser = async (userId, timezone, createdAt, now = new Date()) => {
  const profile = await getEngagementProfile(userId);
  if (profile?.hourlyScores && profile?.totalEvents >= ADAPTIVE_MIN_EVENTS) {
    const entries = Object.entries(profile.hourlyScores || {}).map(([hour, count]) => [Number(hour), Number(count)]);
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      return { hour: sorted[0][0], strategy: 'learned' };
    }
  }

  // Exploration phase for first 24 days per user (or until we collect enough events)
  const explorationHour = getExplorationHour(createdAt, now);
  return { hour: explorationHour, strategy: 'exploration' };
};

const buildDailyPayload = (strategy) => {
  const baseBody = DAILY_MESSAGES[Math.floor(Math.random() * DAILY_MESSAGES.length)];
  const adaptiveSuffix =
    strategy === 'learned'
      ? 'Te escribo cuando mas rindes. Vamos por esa tarea ahora.'
      : 'Probemos este horario para romper la inercia.';

  return {
    title: 'STEEB - Buenos dias',
    body: `${baseBody} ${adaptiveSuffix}`,
    tag: 'daily-motivation',
    data: { url: '/' }
  };
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

export const recordUserEngagement = async (userId, timezone = PUSH_TIMEZONE, occurredAt = new Date()) => {
  if (!userId) return false;

  const { hour } = getTimezoneDateParts(timezone, occurredAt);
  const engagementRef = db.collection(PUSH_ENGAGEMENT_COLLECTION).doc(userId);
  const hourKey = String(hour);

  await engagementRef.set(
    {
      userId,
      timezone,
      hourlyScores: { [hourKey]: admin.firestore.FieldValue.increment(1) },
      totalEvents: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return true;
};

export const startDailyPushScheduler = () => {
  if (!isPushConfigured()) return;

  const checkAndSend = async () => {
    try {
      const now = new Date();
      const todayKey = getDateKey(now);

      if (lastDailySentKey !== todayKey && !shouldSendDailyNow(now)) return;

      const snapshot = await db.collection(PUSH_COLLECTION).get();
      let sent = 0;
      const total = snapshot.size;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const subscription = data.subscription;
        const metadata = data.metadata || {};
        const timezone = metadata.timezone || PUSH_TIMEZONE;

        const { dateKey, hour, minute } = getTimezoneDateParts(timezone, now);
        const lastSentKey = data.lastDailySentKey || lastDailySentPerSubscription.get(doc.id);
        if (lastSentKey === dateKey) continue;

        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt;
        const { hour: bestHour, strategy } = await determineBestHourForUser(metadata.userId, timezone, createdAt, now);

        if (hour < bestHour) continue;
        if (hour === bestHour && minute < PUSH_DAILY_MINUTE) continue;

        const payload = buildDailyPayload(strategy);
        const ok = await sendPushToSubscription(subscription, payload);
        if (ok) {
          sent += 1;
          lastDailySentPerSubscription.set(doc.id, dateKey);
          await db.collection(PUSH_COLLECTION).doc(doc.id).set(
            {
              lastDailySentKey: dateKey,
              adaptiveStrategy: strategy,
              lastAdaptiveHour: bestHour,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        }
      }

      if (sent > 0) {
        lastDailySentKey = todayKey;
        console.log(`Push diario enviado de forma adaptativa a ${sent}/${total} suscriptores`);
      } else if (total === 0) {
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
