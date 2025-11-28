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

const investigateUsers = async () => {
  const userIDs = [
    'x2P66UYUjoXatkKdcIhMZPJKJ7n1',
    'hFkex8GLbFTp8zQ6xm5TVLzSr4B3'
  ];

  console.log('🔍 Investigating specific users...');

  for (const userID of userIDs) {
    console.log(`\n👤 Investigating user: ${userID}`);

    try {
      // Get user from Firestore
      const userDoc = await db.collection('users').doc(userID).get();

      if (!userDoc.exists) {
        console.log(`❌ User ${userID} does not exist in Firestore`);
        continue;
      }

      const userData = userDoc.data();
      console.log(`📧 Email: ${userData.email || 'No email'}`);
      console.log(`🏷️  tipoUsuario: "${userData.tipoUsuario || 'MISSING'}"`);
      console.log(`🎯 Permissions: [${(userData.permissions || []).join(', ')}]`);
      console.log(`📅 Created: ${userData.createdAt?.toDate() || 'Unknown'}`);
      console.log(`📅 Updated: ${userData.updatedAt?.toDate() || 'Unknown'}`);
      console.log(`🔥 Is Active: ${userData.isActive || 'Unknown'}`);

      // Check if tipoUsuario exists and its value
      const hasTipoUsuario = 'tipoUsuario' in userData;
      const tipoUsuarioValue = userData.tipoUsuario;
      const isNull = tipoUsuarioValue === null;
      const isUndefined = tipoUsuarioValue === undefined;
      const isEmpty = tipoUsuarioValue === '';

      console.log(`🔍 tipoUsuario field analysis:`);
      console.log(`   - Field exists: ${hasTipoUsuario}`);
      console.log(`   - Value: "${tipoUsuarioValue}"`);
      console.log(`   - Is null: ${isNull}`);
      console.log(`   - Is undefined: ${isUndefined}`);
      console.log(`   - Is empty: ${isEmpty}`);
      console.log(`   - Data type: ${typeof tipoUsuarioValue}`);

      // Also check Firebase Auth
      try {
        const authUser = await admin.auth().getUser(userID);
        console.log(`🔐 Firebase Auth user found:`);
        console.log(`   - Email: ${authUser.email || 'No email'}`);
        console.log(`   - Display Name: ${authUser.displayName || 'No display name'}`);
        console.log(`   - Created: ${authUser.metadata.creationTime}`);
        console.log(`   - Last Sign In: ${authUser.metadata.lastSignInTime}`);
      } catch (authError) {
        console.log(`❌ Firebase Auth user not found: ${authError.message}`);
      }

    } catch (error) {
      console.error(`❌ Error investigating user ${userID}:`, error);
    }
  }

  // Also check for potential creation patterns
  console.log('\n🔍 Checking for potential creation patterns...');

  // Check if these users were created through different methods
  const allUsersSnapshot = await db.collection('users').limit(20).get();

  console.log(`📊 Total users checked: ${allUsersSnapshot.size}`);

  const userTypes = {};
  const creationSources = {};

  allUsersSnapshot.docs.forEach((doc) => {
    const userData = doc.data();
    const tipoUsuario = userData.tipoUsuario || 'MISSING';

    userTypes[tipoUsuario] = (userTypes[tipoUsuario] || 0) + 1;

    // Check for creation patterns
    const hasPermissions = userData.permissions && userData.permissions.length > 0;
    const hasEmail = userData.email;
    const hasAvatar = userData.avatar;

    const creationPattern = `email:${!!hasEmail}-avatar:${!!hasAvatar}-permissions:${hasPermissions}`;
    creationSources[creationPattern] = (creationSources[creationPattern] || 0) + 1;
  });

  console.log('\n📈 User type distribution:');
  Object.entries(userTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} users`);
  });

  console.log('\n🔧 Creation patterns found:');
  Object.entries(creationSources).forEach(([pattern, count]) => {
    console.log(`   ${pattern}: ${count} users`);
  });
};

// Run the function
investigateUsers()
  .then(() => {
    console.log('\n✅ Investigation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Investigation failed:', error);
    process.exit(1);
  });