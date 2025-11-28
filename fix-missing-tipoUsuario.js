import admin from 'firebase-admin';
import 'dotenv/config';

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

const db = admin.firestore();

const fixMissingTipoUsuario = async () => {
  console.log('🔧 Fixing users with missing tipoUsuario field...');

  const userIDsToFix = ['x2P66UYUjoXatkKdcIhMZPJKJ7n1'];

  for (const userID of userIDsToFix) {
    console.log(`\n👤 Processing user: ${userID}`);

    try {
      // Get current user document
      const userDoc = await db.collection('users').doc(userID).get();

      if (!userDoc.exists) {
        console.log(`❌ User ${userID} does not exist in Firestore`);
        continue;
      }

      const userData = userDoc.data();
      console.log(`📧 Email: ${userData.email || 'No email'}`);
      console.log(`🔍 Current tipoUsuario: "${userData.tipoUsuario || 'MISSING'}"`);
      console.log(`🔍 Current permissions: [${(userData.permissions || []).join(', ')}]`);

      // Check if tipoUsuario field is missing
      if (!userData.tipoUsuario) {
        console.log(`⚠️ User ${userID} is missing tipoUsuario field - fixing...`);

        // Update the user with white role
        const userRef = db.collection('users').doc(userID);
        await userRef.update({
          tipoUsuario: 'white',
          permissions: ['basic_features'],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: userData.isActive !== undefined ? userData.isActive : true
        });

        console.log(`✅ Fixed user ${userID} with tipoUsuario: 'white'`);

        // Update global statistics
        const statsRef = db.collection('global_stats').doc('general_stats');
        await statsRef.update({
          '2_whiteUsers': admin.firestore.FieldValue.increment(1),
          '0_lastUpdated': admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Updated global statistics: +1 white user`);

      } else {
        console.log(`✅ User ${userID} already has tipoUsuario: "${userData.tipoUsuario}"`);
      }

    } catch (error) {
      console.error(`❌ Error fixing user ${userID}:`, error);
    }
  }

  // Verify the fix
  console.log('\n🔍 Verifying fixes...');

  for (const userID of userIDsToFix) {
    try {
      const userDoc = await db.collection('users').doc(userID).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log(`👤 ${userID}: tipoUsuario = "${userData.tipoUsuario || 'STILL_MISSING'}"`);
      }
    } catch (error) {
      console.error(`❌ Error verifying user ${userID}:`, error);
    }
  }

  console.log('\n🎉 Fix process completed!');
};

// Run the function
fixMissingTipoUsuario()
  .then(() => {
    console.log('\n✅ All fixes completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fix process failed:', error);
    process.exit(1);
  });