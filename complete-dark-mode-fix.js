import admin from 'firebase-admin';
import 'dotenv/config';
import { updateUserTipo } from './lib/firebase.js';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
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

const completeDarkModeFix = async () => {
  console.log('🔧 Completing dark mode fix for user x2P66UYUjoXatkKdcIhMZPJKJ7n1...');

  const targetUserID = 'x2P66UYUjoXatkKdcIhMZPJKJ7n1';
  const db = admin.firestore();

  try {
    // Get current user state
    const userDoc = await db.collection('users').doc(targetUserID).get();
    if (!userDoc.exists) {
      console.log(`❌ User ${targetUserID} not found`);
      return;
    }

    const userData = userDoc.data();
    console.log(`👤 Current user state:`);
    console.log(`   📧 Email: ${userData.email}`);
    console.log(`   🏷️  tipoUsuario: "${userData.tipoUsuario}"`);
    console.log(`   🎯 Permissions: [${(userData.permissions || []).join(', ')}]`);

    // Check if tipoUsuario needs to be updated to "black"
    if (userData.tipoUsuario !== 'black') {
      console.log(`\n🔄 Updating tipoUsuario from "${userData.tipoUsuario}" to "black"...`);

      await updateUserTipo(
        targetUserID,
        'black',
        ['dark_mode', 'basic_features']
      );

      console.log(`✅ User tipoUsuario updated to "black" with dark mode permissions`);
    } else {
      console.log(`\n✅ User already has tipoUsuario: "black"`);
    }

    // Verify final state
    const updatedUserDoc = await db.collection('users').doc(targetUserID).get();
    const updatedData = updatedUserDoc.data();

    console.log(`\n🎉 Final user state:`);
    console.log(`   📧 Email: ${updatedData.email}`);
    console.log(`   🏷️  tipoUsuario: "${updatedData.tipoUsuario}"`);
    console.log(`   🎯 Permissions: [${(updatedData.permissions || []).join(', ')}]`);
    console.log(`   🔢 darkClubNumber: ${updatedData.darkClubNumber || 'MISSING'}`);
    console.log(`   🏷️  darkClubNickname: "${updatedData.darkClubNickname || 'MISSING'}"`);
    console.log(`   🔧 darkModeEnabled: ${updatedData.darkModeEnabled || 'MISSING'}`);
    console.log(`   📅 darkModeUnlockedAt: ${updatedData.darkModeUnlockedAt?.toDate() || 'MISSING'}`);
    console.log(`   📖 darkWelcomeMessageVersion: ${updatedData.darkWelcomeMessageVersion || 'MISSING'}`);

    // Check if all required fields are present
    const requiredFields = [
      'tipoUsuario', 'permissions', 'darkClubNumber',
      'darkClubNickname', 'darkModeEnabled', 'darkModeUnlockedAt'
    ];

    const allFieldsPresent = requiredFields.every(field => {
      const hasField = updatedData[field] !== undefined && updatedData[field] !== null;
      if (!hasField) {
        console.log(`   ❌ Missing field: ${field}`);
      }
      return hasField;
    });

    if (allFieldsPresent) {
      console.log(`\n✅ All required dark mode fields are present!`);
      console.log(`🎯 User should now have full dark mode functionality`);
    } else {
      console.log(`\n⚠️ Some required fields are still missing`);
    }

  } catch (error) {
    console.error('❌ Error completing dark mode fix:', error);
    throw error;
  }
};

// Run the function
completeDarkModeFix()
  .then(() => {
    console.log('\n🎉 Dark mode fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Dark mode fix failed:', error);
    process.exit(1);
  });