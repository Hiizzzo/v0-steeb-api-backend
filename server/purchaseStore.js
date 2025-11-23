import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PURCHASES_FILE = path.join(__dirname, '..', 'data', 'purchases.json');

const ensureDataDir = () => {
  const dataDir = path.dirname(PURCHASES_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const loadPurchases = () => {
  try {
    ensureDataDir();
    if (fs.existsSync(PURCHASES_FILE)) {
      const data = fs.readFileSync(PURCHASES_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading purchases:', error);
    return [];
  }
};

const savePurchases = (purchases) => {
  try {
    ensureDataDir();
    fs.writeFileSync(PURCHASES_FILE, JSON.stringify(purchases, null, 2));
    return true;
  } catch (error) {
    if (error.code === 'EROFS') {
      console.warn('⚠️ Read-only file system detected. Skipping local backup (expected in Vercel).');
    } else {
      console.error('Error saving purchases:', error);
    }
    return false;
  }
};

export const createPurchaseStore = () => {
  return {
    async upsert(record) {
      const purchases = loadPurchases();
      const existingIndex = purchases.findIndex(p => p.paymentId === record.paymentId);

      if (existingIndex >= 0) {
        purchases[existingIndex] = { ...purchases[existingIndex], ...record };
      } else {
        purchases.push(record);
      }

      savePurchases(purchases);
      return record;
    },

    async getStatus(planId, userId, email) {
      const purchases = loadPurchases();

      const userPurchases = purchases.filter(p =>
        p.planId === planId &&
        (p.userId === userId || p.email === email)
      );

      if (userPurchases.length === 0) {
        return {
          hasPurchased: false,
          status: 'none',
          planId,
          userId,
          email
        };
      }

      // Obtener la compra más reciente
      const latestPurchase = userPurchases.sort((a, b) =>
        new Date(b.processedAt) - new Date(a.processedAt)
      )[0];

      return {
        hasPurchased: latestPurchase.status === 'approved',
        status: latestPurchase.status,
        statusDetail: latestPurchase.statusDetail,
        planId: latestPurchase.planId,
        userId: latestPurchase.userId,
        email: latestPurchase.email,
        paymentId: latestPurchase.paymentId,
        amount: latestPurchase.amount,
        currency: latestPurchase.currency,
        processedAt: latestPurchase.processedAt,
        approvedAt: latestPurchase.approvedAt
      };
    },

    async getAll() {
      return loadPurchases();
    },

    async getByPaymentId(paymentId) {
      const purchases = loadPurchases();
      return purchases.find(p => p.paymentId === paymentId);
    }
  };
};