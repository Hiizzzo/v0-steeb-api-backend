import { db } from '../../lib/firebase.js';

export default async function handler(req, res) {
  try {
    const userId = req.method === 'GET' ? req.query.userId : req.body?.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const docRef = db.collection('users').doc(userId);

    if (req.method === 'GET') {
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'User not found' });
      const data = snap.data();
      const profile = {
        availabilityNote: data.availabilityNote || null,
        busyLevel: data.busyLevel || null,
        morningPlan: data.morningPlan || null,
        afternoonPlan: data.afternoonPlan || null,
        nightPlan: data.nightPlan || null,
        transcriptText: data.transcriptText || null,
        lastUpdated: data.availabilityUpdatedAt || null
      };
      return res.status(200).json({ profile });
    }

    if (req.method === 'POST') {
      const { availabilityNote, busyLevel, morningPlan, afternoonPlan, nightPlan, transcriptText, name, nickname } = req.body || {};
      const updates = {
        ...(availabilityNote !== undefined && { availabilityNote }),
        ...(busyLevel !== undefined && { busyLevel }),
        ...(morningPlan !== undefined && { morningPlan }),
        ...(afternoonPlan !== undefined && { afternoonPlan }),
        ...(nightPlan !== undefined && { nightPlan }),
        ...(transcriptText !== undefined && { transcriptText }),
        ...(name !== undefined && { name, nombre: name }), // Save both for compatibility
        ...(nickname !== undefined && { nickname, apodo: nickname }), // Save both for compatibility
        availabilityUpdatedAt: new Date().toISOString()
      };

      await docRef.set(updates, { merge: true });
      return res.status(200).json({ success: true, profile: updates });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[profile] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
