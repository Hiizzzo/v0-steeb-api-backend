import admin from 'firebase-admin';
import 'dotenv/config';

// Check if Firebase is already initialized
if (!admin.apps.length) {
  try {
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

export const db = admin.firestore();
export const auth = admin.auth();

// Helper function to create user in Firestore
export const createUserInFirestore = async (userData) => {
  try {
    const userRef = db.collection('users').doc(userData.id);

    const userDoc = {
      id: userData.id,
      email: userData.email || null,
      tipoUsuario: userData.tipoUsuario || 'white', // white, black, shiny
      permissions: userData.permissions || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPayment: null,
      isActive: true
    };

    await userRef.set(userDoc);
    console.log(`✅ User created in Firestore: ${userData.id}`);

    return userDoc;
  } catch (error) {
    console.error('❌ Error creating user in Firestore:', error);
    throw error;
  }
};

// Helper function to get user from Firestore
export const getUserFromFirestore = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return null;
    }

    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('❌ Error getting user from Firestore:', error);
    throw error;
  }
};

// Helper function to update user tipo
export const updateUserTipo = async (userId, tipoUsuario, permissions = []) => {
  try {
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      tipoUsuario: tipoUsuario,
      permissions: permissions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ User tipo updated: ${userId} -> ${tipoUsuario}`);

    return true;
  } catch (error) {
    console.error('❌ Error updating user tipo:', error);
    throw error;
  }
};

// Helper function to create payment record
export const createPaymentRecord = async (paymentData) => {
  try {
    const paymentRef = db.collection('payments').doc(paymentData.id);

    const paymentDoc = {
      id: paymentData.id,
      userId: paymentData.userId,
      planId: paymentData.planId,
      status: paymentData.status || 'pending',
      amount: paymentData.amount || 0,
      currency: paymentData.currency || 'ARS',
      externalReference: paymentData.externalReference || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await paymentRef.set(paymentDoc);
    console.log(`✅ Payment record created: ${paymentData.id}`);

    return paymentDoc;
  } catch (error) {
    console.error('❌ Error creating payment record:', error);
    throw error;
  }
};

// Helper function to update payment status
export const updatePaymentStatus = async (paymentId, status, additionalData = {}) => {
  try {
    const paymentRef = db.collection('payments').doc(paymentId);

    await paymentRef.update({
      status: status,
      ...additionalData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Payment status updated: ${paymentId} -> ${status}`);

    return true;
  } catch (error) {
    console.error('❌ Error updating payment status:', error);
    throw error;
  }
};

// Helper function to add shiny rolls to user
export const addShinyRolls = async (userId, amount) => {
  try {
    const userRef = db.collection('users').doc(userId);
    
    // Usar transacción o incremento atómico para evitar condiciones de carrera
    await userRef.update({
      shinyRolls: admin.firestore.FieldValue.increment(amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Added ${amount} shiny rolls to user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error adding shiny rolls:', error);
    // Si el usuario no tiene el campo shinyRolls, intentar crearlo
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.set({
        shinyRolls: amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`✅ Created shinyRolls field and added ${amount} rolls to user ${userId}`);
      return true;
    } catch (retryError) {
      console.error('❌ Critical error adding shiny rolls:', retryError);
      throw retryError;
    }
  }
};

export default admin;