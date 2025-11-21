import { createPurchaseStore } from '../../server/purchaseStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { planId, userId, email } = req.query;

    if (!planId) {
      return res.status(400).json({ error: 'planId es requerido' });
    }

    if (!userId && !email) {
      return res
        .status(400)
        .json({ error: 'Envía userId o email para consultar el estado de compra.' });
    }

    const store = await createPurchaseStore();
    const status = await store.getStatus(planId, userId, email);
    res.json(status);
  } catch (error) {
    console.error('❌ Error obteniendo estado de pagos:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo obtener el estado de pago'
    });
  }
}