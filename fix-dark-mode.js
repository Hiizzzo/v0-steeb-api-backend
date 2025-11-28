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

const isDarkTipo = (value) => {
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return normalized === 'dark' || normalized === 'black';
};

const investigateAndFixDarkMode = async () => {
  console.log('🔍 Investigating dark mode requirements for user x2P66UYUjoXatkKdcIhMZPJKJ7n1...');

  const targetUserID = 'x2P66UYUjoXatkKdcIhMZPJKJ7n1';

  try {
    // Get target user
    const targetUserDoc = await db.collection('users').doc(targetUserID).get();
    if (!targetUserDoc.exists) {
      console.log(`❌ Target user ${targetUserID} not found`);
      return;
    }

    const targetUserData = targetUserDoc.data();
    console.log(`👤 Target user analysis:`);
    console.log(`   📧 Email: ${targetUserData.email}`);
    console.log(`   🏷️  tipoUsuario: "${targetUserData.tipoUsuario}"`);
    console.log(`   🎯 Permissions: [${(targetUserData.permissions || []).join(', ')}]`);

    // Check required dark mode fields
    const requiredDarkFields = [
      'darkClubNumber',
      'darkClubNickname',
      'darkModeEnabled',
      'darkModeUnlockedAt',
      'darkWelcomeMessageVersion'
    ];

    console.log(`\n🔍 Checking required dark mode fields:`);
    requiredDarkFields.forEach(field => {
      const value = targetUserData[field];
      const hasField = field in targetUserData;
      const isNull = value === null;
      const isUndefined = value === undefined;

      console.log(`   ${field}: ${hasField ? `"${value}"` : 'MISSING'} (${hasField ? 'exists' : 'missing'})`);
    });

    // Get other black users for comparison
    console.log(`\n🔍 Comparing with other working black users...`);
    const blackUsersSnapshot = await db.collection('users')
      .where('tipoUsuario', '==', 'black')
      .get();

    console.log(`📊 Found ${blackUsersSnapshot.size} users with tipoUsuario: 'black'`);

    let workingBlackUsers = [];
    blackUsersSnapshot.forEach(doc => {
      if (doc.id !== targetUserID) {
        workingBlackUsers.push({ id: doc.id, ...doc.data() });
      }
    });

    if (workingBlackUsers.length > 0) {
      console.log(`\n📋 Analysis of working black users:`);
      workingBlackUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email || 'No email'} (${user.id.substring(0, 8)}...)`);
        requiredDarkFields.forEach(field => {
          const value = user[field];
          console.log(`      ${field}: ${value !== undefined ? `"${value}"` : 'MISSING'}`);
        });
      });

      // Check what's missing in target user
      const targetFields = {};
      workingBlackUsers.forEach(user => {
        requiredDarkFields.forEach(field => {
          if (user[field] !== undefined) {
            targetFields[field] = user[field];
          }
        });
      });

      console.log(`\n🔧 Fields that should be added to target user:`);
      requiredDarkFields.forEach(field => {
        const hasField = targetUserData[field] !== undefined;
        if (!hasField) {
          console.log(`   ❌ ${field}: MISSING - should be added`);
        } else {
          console.log(`   ✅ ${field}: "${targetUserData[field]}" - OK`);
        }
      });
    }

    // Fix the target user
    console.log(`\n🛠️  Fixing dark mode configuration for target user...`);

    // Get user's nickname/name for dark club
    const nickname =
      targetUserData.apodo ||
      targetUserData.nickname ||
      targetUserData.nombre ||
      targetUserData.name ||
      targetUserData.displayName ||
      targetUserData.email ||
      targetUserID;

    console.log(`🏷️  Using nickname: "${nickname}"`);

    // Get current dark user count for numbering
    const statsDoc = await db.collection('global_stats').doc('general_stats').get();
    const currentDarkUsers = statsDoc.exists ? Number(statsDoc.data()?.["3_darkUsers"] || 0) : 0;
    const assignedDarkClubNumber = currentDarkUsers + 1;

    console.log(`🔢 Assigning dark club number: ${assignedDarkClubNumber}`);

    // Update the user with all required dark mode fields
    const userRef = db.collection('users').doc(targetUserID);
    await userRef.update({
      darkClubNumber: assignedDarkClubNumber,
      darkClubNickname: nickname,
      darkModeEnabled: true,
      darkModeUnlockedAt: admin.firestore.FieldValue.serverTimestamp(),
      darkWelcomeMessageVersion: 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Updated user ${targetUserID} with dark mode configuration`);

    // Update global statistics if this is a new dark user
    const wasDarkBefore = isDarkTipo(targetUserData.tipoUsuario);
    if (!wasDarkBefore) {
      await db.collection('global_stats').doc('general_stats').update({
        "3_darkUsers": admin.firestore.FieldValue.increment(1),
        "2_whiteUsers": admin.firestore.FieldValue.increment(-1),
        "0_lastUpdated": admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Updated global statistics: +1 dark user, -1 white user`);
    }

    console.log(`\n🎉 Dark mode fix completed successfully!`);

  } catch (error) {
    console.error('❌ Error fixing dark mode:', error);
    throw error;
  }
};

// Run the function
investigateAndFixDarkMode()
  .then(() => {
    console.log('\n✅ Dark mode fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Dark mode fix failed:', error);
    process.exit(1);
  });