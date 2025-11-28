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

const assignWhiteRoleToUsers = async () => {
  try {
    console.log('🔄 Starting process to assign "white" role to users without proper tipoUsuario...');

    // Get all users
    const usersSnapshot = await db.collection('users').get();

    console.log(`📊 Total users in database: ${usersSnapshot.size}`);

    // Filter users who need to be updated
    const usersToUpdate = [];
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const tipoUsuario = userData.tipoUsuario;

      // Check if tipoUsuario is missing, null, empty, or literally "undefined"
      if (!tipoUsuario || tipoUsuario === '' || tipoUsuario === 'undefined') {
        usersToUpdate.push(doc);
        console.log(`🔍 Found user needing update: ${doc.id} - Email: ${userData.email || 'No email'} - Current tipoUsuario: "${tipoUsuario || 'null'}"`);
      }
    });

    console.log(`📊 Users needing update: ${usersToUpdate.length}`);

    if (usersToUpdate.length === 0) {
      console.log('✅ All users already have proper tipoUsuario assigned');
      return;
    }

    // Update each user to have 'white' as tipoUsuario
    const batch = db.batch();

    usersToUpdate.forEach((doc) => {
      const userRef = db.collection('users').doc(doc.id);
      console.log(`👤 Updating user: ${doc.id} - Email: ${doc.data().email || 'No email'}`);

      batch.update(userRef, {
        tipoUsuario: 'white',
        permissions: ['basic_features'],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Commit all updates
    await batch.commit();
    console.log(`✅ Successfully updated ${usersToUpdate.length} users with 'white' role`);

    // Update global statistics
    const statsRef = db.collection('global_stats').doc('general_stats');
    await statsRef.update({
      '2_whiteUsers': admin.firestore.FieldValue.increment(usersToUpdate.length),
      '0_lastUpdated': admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Global statistics updated: +${usersToUpdate.length} white users`);

  } catch (error) {
    console.error('❌ Error assigning white role to users:', error);
    throw error;
  }
};

// Run the function
assignWhiteRoleToUsers()
  .then(() => {
    console.log('🎉 Process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Process failed:', error);
    process.exit(1);
  });