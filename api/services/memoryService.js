import { db } from '../../lib/firebase.js';

export const saveMemory = async (userId, content) => {
  try {
    if (!userId || !content) throw new Error('UserId and content are required');
    
    const memoryRef = db.collection('users').doc(userId).collection('memories');
    await memoryRef.add({
      content,
      createdAt: new Date().toISOString(),
      type: 'auto_generated'
    });
    
    console.log(`🧠 Memory saved for user ${userId}: ${content}`);
    return true;
  } catch (error) {
    console.error('Error saving memory:', error);
    return false;
  }
};

export const getMemories = async (userId, limit = 10) => {
  try {
    const memoriesSnapshot = await db.collection('users').doc(userId).collection('memories')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
      
    if (memoriesSnapshot.empty) return [];
    
    return memoriesSnapshot.docs.map(doc => doc.data().content);
  } catch (error) {
    console.error('Error fetching memories:', error);
    return [];
  }
};
