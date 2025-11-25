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

// Helper functions for global shiny user counter

// Get global shiny user statistics
export const getGlobalShinyStats = async () => {
  try {
    const statsRef = db.collection('global_stats').doc('shiny_users');
    const statsDoc = await statsRef.get();

    if (!statsDoc.exists) {
      // Initialize stats if they don't exist
      await statsRef.set({
        totalShinyUsers: 0,
        shinyUsersList: [],
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      return { totalShinyUsers: 0, shinyUsersList: [] };
    }

    return {
      totalShinyUsers: statsDoc.data().totalShinyUsers || 0,
      shinyUsersList: statsDoc.data().shinyUsersList || []
    };
  } catch (error) {
    console.error('❌ Error getting global shiny stats:', error);
    throw error;
  }
};

// Add user to global shiny counter
export const addShinyUserToGlobalCounter = async (userId, userName = null, userAvatar = null) => {
  try {
    const statsRef = db.collection('global_stats').doc('shiny_users');

    // Use transaction to prevent race conditions
    const result = await db.runTransaction(async (transaction) => {
      const statsDoc = await transaction.get(statsRef);

      let currentStats;
      if (!statsDoc.exists) {
        currentStats = {
          totalShinyUsers: 0,
          shinyUsersList: []
        };
      } else {
        currentStats = statsDoc.data();
      }

      // Check if user is already in the list (prevent duplicates)
      const existingUserIndex = currentStats.shinyUsersList.findIndex(user => user.userId === userId);
      if (existingUserIndex !== -1) {
        // User already exists, return current position
        return {
          position: existingUserIndex + 1,
          isNewUser: false,
          totalShinyUsers: currentStats.totalShinyUsers
        };
      }

      // Add new user to the list
      const newShinyUser = {
        userId,
        userName: userName || 'Usuario Anónimo',
        userAvatar: userAvatar || null,
        unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        position: currentStats.totalShinyUsers + 1
      };

      const updatedList = [...currentStats.shinyUsersList, newShinyUser];
      const newTotal = currentStats.totalShinyUsers + 1;

      // Update the document
      transaction.set(statsRef, {
        totalShinyUsers: newTotal,
        shinyUsersList: updatedList,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        position: newTotal,
        isNewUser: true,
        totalShinyUsers: newTotal
      };
    });

    console.log(`✅ User ${userId} added to global shiny counter at position ${result.position}`);
    return result;
  } catch (error) {
    console.error('❌ Error adding shiny user to global counter:', error);
    throw error;
  }
};

// Get position of a specific user in the shiny ranking
export const getShinyUserPosition = async (userId) => {
  try {
    const stats = await getGlobalShinyStats();
    const userIndex = stats.shinyUsersList.findIndex(user => user.userId === userId);

    if (userIndex === -1) {
      return null; // User is not shiny yet
    }

    return {
      position: userIndex + 1,
      totalShinyUsers: stats.totalShinyUsers,
      unlockedAt: stats.shinyUsersList[userIndex].unlockedAt
    };
  } catch (error) {
    console.error('❌ Error getting shiny user position:', error);
    throw error;
  }
};

export default admin;