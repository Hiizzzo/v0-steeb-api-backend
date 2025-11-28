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
    console.log('🔄 Starting process to assign "white" role to users without tipoUsuario...');

    // Get all users without tipoUsuario, with empty tipoUsuario, or with "undefined" tipoUsuario
    const usersSnapshot = await db.collection('users')
      .where('tipoUsuario', 'in', [null, ''])
      .get();

    // Also get users with tipoUsuario literally set to "undefined"
    const undefinedUsersSnapshot = await db.collection('users')
      .where('tipoUsuario', '==', 'undefined')
      .get();

    // Combine both sets of users
    const allUsersToFix = [];
    usersSnapshot.forEach(doc => allUsersToFix.push(doc));
    undefinedUsersSnapshot.forEach(doc => allUsersToFix.push(doc));

    console.log(`📊 Found ${usersSnapshot.size} users with null/empty tipoUsuario`);
    console.log(`📊 Found ${undefinedUsersSnapshot.size} users with 'undefined' tipoUsuario`);
    console.log(`📊 Total users to update: ${allUsersToFix.length}`);

    if (allUsersToFix.length === 0) {
      console.log('✅ All users already have proper tipoUsuario assigned');
      return;
    }

    // Update each user to have 'white' as tipoUsuario
    const batch = db.batch();

    allUsersToFix.forEach((doc) => {
      const userRef = db.collection('users').doc(doc.id);
      console.log(`👤 Updating user: ${doc.id} - Email: ${doc.data().email || 'No email'} - Current tipoUsuario: "${doc.data().tipoUsuario || 'null'}"`);

      batch.update(userRef, {
        tipoUsuario: 'white',
        permissions: ['basic_features'],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Commit all updates
    await batch.commit();
    console.log(`✅ Successfully updated ${allUsersToFix.length} users with 'white' role`);

    // Update global statistics
    const statsRef = db.collection('global_stats').doc('general_stats');
    await statsRef.update({
      '2_whiteUsers': admin.firestore.FieldValue.increment(allUsersToFix.length),
      '0_lastUpdated': admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Global statistics updated: +${allUsersToFix.length} white users`);

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