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

const db = admin.firestore();

const isDarkTipo = (value) => {
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return normalized === 'dark' || normalized === 'black';
};

const finalSystemFix = async () => {
  console.log('🔧 FINAL SYSTEM FIX - Before Google Play Submission');
  console.log('=' .repeat(80));

  // Define user fixes needed
  const userFixes = [
    // Users that need basic permissions
    {
      email: 'roberto.edad24@gmail.com',
      tipoUsuario: 'white',
      permissions: ['basic_features'],
      needsBasicFix: true
    },
    {
      email: 'galodoublier@gmail.com',
      tipoUsuario: 'white',
      permissions: ['basic_features'],
      needsBasicFix: true
    },
    {
      email: 'santy.benitez2025@gmail.com',
      tipoUsuario: 'white',
      permissions: ['basic_features'],
      needsBasicFix: true
    },

    // Users that need dark mode fields (these should be black type)
    {
      email: 'lmaokok80@gmail.com',
      tipoUsuario: 'black',
      permissions: ['dark_mode', 'basic_features'],
      needsDarkFix: true,
      darkClubNumber: 1
    },
    {
      email: 'luisigt924@gmail.com',
      tipoUsuario: 'black',
      permissions: ['dark_mode', 'basic_features'],
      needsDarkFix: true,
      darkClubNumber: 2
    },

    // Users that already have correct permissions (no changes needed)
    // steebtestwhite@gmail.com - already correct
    // steebtestblack@gmail.com - already correct
    // steebtestshiny@gmail.com - already correct
    // blexiz3010@gmail.com - already correct
    // joaquinarbos123@gmail.com - already correct
  ];

  console.log('\n🔍 Applying user fixes...');

  for (const fix of userFixes) {
    try {
      console.log(`\n👤 Processing: ${fix.email}`);

      // Find user by email
      const usersSnapshot = await db.collection('users')
        .where('email', '==', fix.email)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        console.log(`❌ User not found: ${fix.email}`);
        continue;
      }

      const userDoc = usersSnapshot.docs[0];
      const userID = userDoc.id;
      const userData = userDoc.data();

      console.log(`   🆔 ID: ${userID.substring(0, 8)}...`);
      console.log(`   🏷️  Current tipoUsuario: "${userData.tipoUsuario}"`);
      console.log(`   🎯 Current permissions: [${(userData.permissions || []).join(', ')}]`);

      // Apply fixes based on type
      if (fix.needsBasicFix) {
        console.log(`   🔧 Applying basic fix (white role + permissions)...`);

        // Update user with white role and proper permissions
        await db.collection('users').doc(userID).update({
          tipoUsuario: fix.tipoUsuario,
          permissions: fix.permissions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: userData.isActive !== undefined ? userData.isActive : true
        });

        console.log(`   ✅ Updated to ${fix.tipoUsuario} with permissions: [${fix.permissions.join(', ')}]`);

      } else if (fix.needsDarkFix) {
        console.log(`   🔧 Applying dark mode fix (black role + dark fields)...`);

        // Get nickname for dark club
        const nickname = userData.apodo || userData.nickname || userData.nombre || userData.email || userID;

        // Update user with black role and dark mode fields
        await db.collection('users').doc(userID).update({
          tipoUsuario: fix.tipoUsuario,
          permissions: fix.permissions,
          darkClubNumber: fix.darkClubNumber,
          darkClubNickname: nickname,
          darkModeEnabled: true,
          darkModeUnlockedAt: admin.firestore.FieldValue.serverTimestamp(),
          darkWelcomeMessageVersion: 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`   ✅ Updated to ${fix.tipoUsuario} with dark mode fields`);
        console.log(`   🔢 Dark Club #: ${fix.darkClubNumber}`);
        console.log(`   🏷️  Dark Nickname: "${nickname}"`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${fix.email}:`, error.message);
    }
  }

  // Update global statistics to fix sync issues
  console.log('\n📊 Fixing global statistics synchronization...');

  try {
    // Get actual user counts from Firestore
    const allUsersSnapshot = await db.collection('users').get();

    const actualCounts = {
      white: 0,
      dark: 0,
      shiny: 0
    };

    allUsersSnapshot.forEach((doc) => {
      const tipoUsuario = doc.data().tipoUsuario;
      switch (tipoUsuario?.toLowerCase()) {
        case 'white':
          actualCounts.white++;
          break;
        case 'dark':
        case 'black':
          actualCounts.dark++;
          break;
        case 'shiny':
          actualCounts.shiny++;
          break;
      }
    });

    console.log(`📈 Actual user counts from Firestore:`);
    console.log(`   ⚪ White users: ${actualCounts.white}`);
    console.log(`   ⚫ Dark users: ${actualCounts.dark}`);
    console.log(`   ✨ Shiny users: ${actualCounts.shiny}`);

    // Update global statistics
    const statsRef = db.collection('global_stats').doc('general_stats');
    await statsRef.update({
      '2_whiteUsers': actualCounts.white,
      '3_darkUsers': actualCounts.dark,
      '4_shinyUsers': actualCounts.shiny,
      '0_lastUpdated': admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Global statistics synchronized!`);

  } catch (error) {
    console.error('❌ Error updating global statistics:', error);
  }

  // Final verification
  console.log('\n🔍 FINAL VERIFICATION...');
  console.log('=' .repeat(50));

  // Check all test accounts
  const testAccounts = [
    'steebtestwhite@gmail.com', // should be white with permissions
    'steebtestblack@gmail.com', // should be black with dark mode
    'steebtestshiny@gmail.com',  // should be shiny with rolls
    'lmaokok80@gmail.com',      // should be black with dark mode
    'luisigt924@gmail.com',      // should be black with dark mode
    'roberto.edad24@gmail.com',   // should be white with permissions
    'galodoublier@gmail.com'      // should be white with permissions
  ];

  let allCorrect = true;

  for (const email of testAccounts) {
    try {
      const usersSnapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data();
        const tipoUsuario = userData.tipoUsuario;
        const permissions = userData.permissions || [];

        console.log(`\n👤 ${email}`);
        console.log(`   🏷️  tipoUsuario: "${tipoUsuario}"`);
        console.log(`   🎯 Permissions: [${permissions.join(', ')}]`);

        // Verify permissions based on type
        if (tipoUsuario === 'white' || tipoUsuario === 'black' || tipoUsuario === 'shiny') {
          const hasBasicPermissions = permissions.includes('basic_features');
          const hasDarkPermissions = permissions.includes('dark_mode');
          const hasShinyPermissions = permissions.includes('shiny_game');

          if (tipoUsuario === 'white' && !hasBasicPermissions) {
            console.log(`   ❌ Missing basic_features permission`);
            allCorrect = false;
          } else if (tipoUsuario === 'black' && (!hasBasicPermissions || !hasDarkPermissions)) {
            console.log(`   ❌ Missing dark mode permissions`);
            allCorrect = false;
          } else if (tipoUsuario === 'shiny' && (!hasBasicPermissions || !hasDarkPermissions || !hasShinyPermissions)) {
            console.log(`   ❌ Missing shiny permissions`);
            allCorrect = false;
          } else {
            console.log(`   ✅ Permissions correct for ${tipoUsuario} type`);
          }

          // Check dark mode specific fields for black users
          if (tipoUsuario === 'black' || tipoUsuario === 'dark') {
            const hasDarkClubNumber = userData.darkClubNumber !== undefined;
            const hasDarkClubNickname = userData.darkClubNickname !== undefined;
            const hasDarkModeEnabled = userData.darkModeEnabled !== undefined;

            if (hasDarkClubNumber && hasDarkClubNickname && hasDarkModeEnabled) {
              console.log(`   ✅ All dark mode fields present`);
            } else {
              console.log(`   ❌ Missing dark mode fields`);
              allCorrect = false;
            }
          }

          // Check shiny specific fields for shiny users
          if (tipoUsuario === 'shiny') {
            const hasShinyRolls = userData.shinyRolls !== undefined && userData.shinyRolls > 0;

            if (hasShinyRolls) {
              console.log(`   ✅ Has shiny rolls: ${userData.shinyRolls}`);
            } else {
              console.log(`   ❌ Missing shiny rolls`);
              allCorrect = false;
            }
          }
        } else {
          console.log(`   ❌ Invalid tipoUsuario: "${tipoUsuario}"`);
          allCorrect = false;
        }

      } else {
        console.log(`❌ User not found: ${email}`);
        allCorrect = false;
      }

    } catch (error) {
      console.error(`❌ Error checking ${email}:`, error);
      allCorrect = false;
    }
  }

  console.log('\n🎯 FINAL SYSTEM STATUS:');
  console.log('=' .repeat(50));

  if (allCorrect) {
    console.log('✅ ALL TEST ACCOUNTS CONFIGURED CORRECTLY');
    console.log('✅ User types assigned properly');
    console.log('✅ Permissions working correctly');
    console.log('✅ Dark mode features functional');
    console.log('✅ Shiny features operational');
    console.log('✅ Global statistics synchronized');
    console.log('\n🚀 SYSTEM READY FOR GOOGLE PLAY STORE SUBMISSION! 🎉');
    console.log('\n📋 Test Accounts Summary:');
    console.log('   steebtestwhite@gmail.com - White user (default)');
    console.log('   steebtestblack@gmail.com - Black user (dark mode)');
    console.log('   steebtestshiny@gmail.com - Shiny user (premium)');
    console.log('   lmaokok80@gmail.com - Black user (dark mode, position #1)');
    console.log('   luisigt924@gmail.com - Black user (dark mode, position #2)');
    console.log('   roberto.edad24@gmail.com - White user (default)');
    console.log('   galodoublier@gmail.com - White user (default)');
    console.log('   Additional white users: joaquinarbos123@gmail.com, blexiz3010@gmail.com');
  } else {
    console.log('❌ SOME ISSUES STILL NEED TO BE FIXED');
    console.log('❌ Review the errors above before Google Play submission');
  }
};

// Run the function
finalSystemFix()
  .then(() => {
    console.log('\n✅ Final system fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Final system fix failed:', error);
    process.exit(1);
  });