import { MercadoPagoConfig } from 'mercadopago';
import 'dotenv/config';
import { createPurchaseStore } from '../../server/purchaseStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';

const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN });

const mpRequest = async (endpoint, options = {}) => {
  const url = `https://api.mercadopago.com${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return await response.json();
};

const searchPayment = async ({ preferenceId, externalReference }) => {
  const params = new URLSearchParams();
  if (externalReference) params.append('external_reference', externalReference);
  if (preferenceId) params.append('preference_id', preferenceId);
  params.append('sort', 'date_created');
  params.append('criteria', 'desc');

  const response = await mpRequest(`/v1/payments/search?${params.toString()}`, {
    method: 'GET',
  });

  return response.results?.[0] || null;
};

const mapPaymentToRecord = (payment) => {
  if (!payment) return null;
  return {
    paymentId: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    planId: payment.external_reference?.split('_')[0] || 'unknown',
    userId: payment.external_reference?.split('_')[1] || null,
    email: payment.payer?.email,
    externalReference: payment.external_reference,
    preferenceId: payment.order?.id,
    amount: payment.transaction_amount,
    currency: payment.currency_id,
    processedAt: payment.date_created,
    approvedAt: payment.date_approved
  };
};

const persistPaymentFromMercadoPago = async (payment) => {
  const record = mapPaymentToRecord(payment);
  if (!record) {
    throw new Error('Pago no encontrado en Mercado Pago');
  }
  const store = await createPurchaseStore();
  await store.upsert(record);
  return record;
};

const fetchPaymentById = async (id) => {
  return await mpRequest(`/v1/payments/${id}`, { method: 'GET' });
};

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { paymentId, externalReference, preferenceId } = req.body || {};

    if (!paymentId && !externalReference && !preferenceId) {
      return res
        .status(400)
        .json({ error: 'Debes enviar paymentId o externalReference/preferenceId' });
    }

    let payment = null;

    if (paymentId) {
      payment = await fetchPaymentById(paymentId);
    } else {
      payment = await searchPayment({ preferenceId, externalReference });
    }

    if (!payment) {
      return res.status(404).json({ error: 'No se encontraron pagos registrados todavía.' });
    }

    const record = await persistPaymentFromMercadoPago(payment);
    res.json({
      ...record,
      message: record.status === 'approved'
        ? 'Pago aprobado'
        : `Estado actual: ${record.status}`
    });
  } catch (error) {
    console.error('❌ Error verificando pago Mercado Pago:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo verificar el pago'
    });
  }
}