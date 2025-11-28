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

const verifyUserTypes = async () => {
  try {
    console.log('🔍 Verifying user tipoUsuario assignments...');

    // Get all users
    const usersSnapshot = await db.collection('users').limit(20).get();

    console.log(`📊 Total users found: ${usersSnapshot.size}`);
    console.log('');

    let whiteUsers = 0;
    let darkUsers = 0;
    let shinyUsers = 0;
    let otherTypes = 0;

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const tipoUsuario = userData.tipoUsuario || 'undefined';

      console.log(`👤 User ID: ${doc.id}`);
      console.log(`   📧 Email: ${userData.email || 'No email'}`);
      console.log(`   🏷️  tipoUsuario: "${tipoUsuario}"`);
      console.log(`   🎯 Permissions: [${(userData.permissions || []).join(', ')}]`);
      console.log(`   📅 Created: ${userData.createdAt?.toDate() || 'Unknown'}`);
      console.log('');

      switch (tipoUsuario.toLowerCase()) {
        case 'white':
          whiteUsers++;
          break;
        case 'dark':
        case 'black':
          darkUsers++;
          break;
        case 'shiny':
          shinyUsers++;
          break;
        default:
          otherTypes++;
          break;
      }
    });

    console.log('📈 Summary:');
    console.log(`   ⚪ White users: ${whiteUsers}`);
    console.log(`   ⚫ Dark/Black users: ${darkUsers}`);
    console.log(`   ✨ Shiny users: ${shinyUsers}`);
    console.log(`   ❓ Other/undefined: ${otherTypes}`);

    // Check global statistics
    const statsDoc = await db.collection('global_stats').doc('general_stats').get();
    if (statsDoc.exists) {
      const stats = statsDoc.data();
      console.log('');
      console.log('📊 Global Statistics:');
      console.log(`   ⚪ White users (from stats): ${stats['2_whiteUsers'] || 0}`);
      console.log(`   ⚫ Dark users (from stats): ${stats['3_darkUsers'] || 0}`);
      console.log(`   ✨ Shiny users (from stats): ${stats['4_shinyUsers'] || 0}`);
    }

    console.log('');
    console.log('✅ Verification completed successfully!');

  } catch (error) {
    console.error('❌ Error verifying user types:', error);
    throw error;
  }
};

// Run the function
verifyUserTypes()
  .then(() => {
    console.log('🎉 Verification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Verification failed:', error);
    process.exit(1);
  });