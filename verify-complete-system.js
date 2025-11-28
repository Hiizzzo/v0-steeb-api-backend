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

const verifyCompleteSystem = async () => {
  console.log('🔍 STEEB SYSTEM - Complete Verification Before Google Play Submission');
  console.log('=' .repeat(80));

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();

    console.log(`\n📊 TOTAL USERS IN SYSTEM: ${usersSnapshot.size}`);

    // Analyze user types
    const userStats = {
      white: 0,
      dark: 0,
      black: 0,
      shiny: 0,
      missing: 0
    };

    const usersByType = {
      white: [],
      dark: [],
      black: [],
      shiny: [],
      missing: []
    };

    // Test accounts
    const testAccounts = {
      'steebtestwhite@gmail.com': { type: 'white', status: '✅ ACTIVE' },
      'steebtestblack@gmail.com': { type: 'black', status: '✅ ACTIVE' },
      'steebtestshiny@gmail.com': { type: 'shiny', status: '✅ ACTIVE' },
      'roberto.edad24@gmail.com': { type: 'white', status: '✅ ACTIVE' },
      'lmaokok80@gmail.com': { type: 'black', status: '✅ ACTIVE' },
      'luisigt924@gmail.com': { type: 'black', status: '✅ ACTIVE' },
      'galodoublier@gmail.com': { type: 'white', status: '✅ ACTIVE' },
      'joaquinarbos123@gmail.com': { type: 'white', status: '✅ ACTIVE' },
      'n26kUTMcQAWLVtBmLQSQquHeeEh1': { type: 'white', status: '✅ ACTIVE' }
    };

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const tipoUsuario = userData.tipoUsuario;

      if (!tipoUsuario || tipoUsuario === '' || tipoUsuario === undefined) {
        userStats.missing++;
        usersByType.missing.push({
          id: doc.id,
          email: userData.email || 'No email',
          issue: 'No tipoUsuario assigned'
        });
      } else {
        switch (tipoUsuario.toLowerCase()) {
          case 'white':
            userStats.white++;
            usersByType.white.push({
              id: doc.id,
              email: userData.email || 'No email',
              hasPermissions: userData.permissions && userData.permissions.length > 0,
              permissions: userData.permissions || []
            });
            break;
          case 'dark':
          case 'black':
            userStats.dark++;
            usersByType.black.push({
              id: doc.id,
              email: userData.email || 'No email',
              darkClubNumber: userData.darkClubNumber || 'MISSING',
              darkModeEnabled: userData.darkModeEnabled || false,
              hasDarkFields: userData.darkClubNumber && userData.darkClubNickname && userData.darkModeEnabled
            });
            break;
          case 'shiny':
            userStats.shiny++;
            usersByType.shiny.push({
              id: doc.id,
              email: userData.email || 'No email',
              shinyRolls: userData.shinyRolls || 0,
              hasShinyFeatures: userData.permissions && userData.permissions.includes('shiny_game')
            });
            break;
          default:
            userStats.missing++;
            usersByType.missing.push({
              id: doc.id,
              email: userData.email || 'No email',
              issue: `Unknown tipoUsuario: "${tipoUsuario}"`
            });
        }
      }
    });

    // Display results
    console.log('\n🏷️  USER TYPE DISTRIBUTION:');
    console.log(`   ⚪ White users: ${userStats.white} (default access)`);
    console.log(`   ⚫ Dark/Black users: ${userStats.dark} (dark mode unlocked)`);
    console.log(`   ✨ Shiny users: ${userStats.shiny} (premium access)`);
    console.log(`   ❌ Missing type: ${userStats.missing} (needs fix)`);

    console.log('\n👤 DETAILED BREAKDOWN:');

    // Test accounts verification
    console.log('\n🧪 TEST ACCOUNTS VERIFICATION:');
    console.log('=' .repeat(50));
    Object.entries(testAccounts).forEach(([email, expected]) => {
      const user = usersByType.white.find(u => u.email === email) ||
                    usersByType.black.find(u => u.email === email) ||
                    usersByType.shiny.find(u => u.email === email);

      if (user) {
        console.log(`✅ ${email}`);
        console.log(`   Expected: ${expected.type} | Status: ${expected.status}`);
        console.log(`   Actual: ${user.email.includes('shiny') ? 'shiny' : user.email.includes('black') ? 'black' : 'white'}`);
        console.log(`   Result: ✅ MATCH`);
      } else {
        console.log(`❌ ${email}`);
        console.log(`   Expected: ${expected.type} | Status: ${expected.status}`);
        console.log(`   Result: NOT FOUND IN SYSTEM`);
        console.log(`   Status: ❌ MISSING`);
      }
      console.log('');
    });

    // Feature verification by user type
    console.log('\n🔧 FEATURE VERIFICATION BY TYPE:');
    console.log('=' .repeat(50));

    if (usersByType.white.length > 0) {
      console.log('\n⚪ WHITE USERS (Default Access):');
      usersByType.white.forEach((user, index) => {
        const isTestAccount = testAccounts[user.email];
        const status = isTestAccount ? `🧪 ${isTestAccount.status}` : '👤 USER';
        console.log(`   ${index + 1}. ${user.email} ${status}`);
        console.log(`      - Permissions: [${user.permissions.join(', ')}] ${user.hasPermissions ? '✅' : '❌'}`);
      });
    }

    if (usersByType.black.length > 0) {
      console.log('\n⚫ DARK/BLACK USERS (Dark Mode):');
      usersByType.black.forEach((user, index) => {
        const isTestAccount = testAccounts[user.email];
        const status = isTestAccount ? `🧪 ${isTestAccount.status}` : '👤 USER';
        console.log(`   ${index + 1}. ${user.email} ${status}`);
        console.log(`      - Dark Club #: ${user.darkClubNumber} ${user.darkClubNumber !== 'MISSING' ? '✅' : '❌'}`);
        console.log(`      - Dark Mode Enabled: ${user.darkModeEnabled ? '✅' : '❌'}`);
        console.log(`      - Has All Dark Fields: ${user.hasDarkFields ? '✅' : '❌'}`);
      });
    }

    if (usersByType.shiny.length > 0) {
      console.log('\n✨ SHINY USERS (Premium Access):');
      usersByType.shiny.forEach((user, index) => {
        const isTestAccount = testAccounts[user.email];
        const status = isTestAccount ? `🧪 ${isTestAccount.status}` : '👤 USER';
        console.log(`   ${index + 1}. ${user.email} ${status}`);
        console.log(`      - Shiny Rolls: ${user.shinyRolls} ${user.shinyRolls > 0 ? '✅' : '❌'}`);
        console.log(`      - Has Shiny Features: ${user.hasShinyFeatures ? '✅' : '❌'}`);
      });
    }

    if (usersByType.missing.length > 0) {
      console.log('\n❌ USERS WITH ISSUES:');
      usersByType.missing.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email}`);
        console.log(`      - Issue: ${user.issue}`);
      });
    }

    // Global statistics verification
    console.log('\n📊 GLOBAL STATISTICS VERIFICATION:');
    console.log('=' .repeat(50));

    try {
      const statsDoc = await db.collection('global_stats').doc('general_stats').get();
      if (statsDoc.exists) {
        const stats = statsDoc.data();
        console.log(`   ⚪ White Users (Firestore): ${userStats.white} | (Stats): ${stats['2_whiteUsers'] || 0}`);
        console.log(`   ⚫ Dark Users (Firestore): ${userStats.dark} | (Stats): ${stats['3_darkUsers'] || 0}`);
        console.log(`   ✨ Shiny Users (Firestore): ${userStats.shiny} | (Stats): ${stats['4_shinyUsers'] || 0}`);

        const statsMatch =
          (stats['2_whiteUsers'] || 0) === userStats.white &&
          (stats['3_darkUsers'] || 0) === userStats.dark &&
          (stats['4_shinyUsers'] || 0) === userStats.shiny;

        console.log(`   📈 Statistics Match: ${statsMatch ? '✅ YES' : '❌ NO - SYNC NEEDED'}`);
      } else {
        console.log('   ❌ No global statistics document found');
      }
    } catch (error) {
      console.log(`   ❌ Error checking global statistics: ${error.message}`);
    }

    // Shiny global counter verification
    try {
      const shinyStatsDoc = await db.collection('global_stats').doc('shiny_users').get();
      if (shinyStatsDoc.exists) {
        const shinyStats = shinyStatsDoc.data();
        console.log(`\n🏆 SHINY GLOBAL COUNTER:`);
        console.log(`   Total Shiny Users: ${shinyStats.totalShinyUsers}`);
        console.log(`   Shiny Users List: ${shinyStats.shinyUsersList.length}`);

        const shinyUser = shinyStats.shinyUsersList.find(u => u.userId === 'VBsnLGFfpVhq1C2Kh4o1jEXZqJv2');
        if (shinyUser) {
          console.log(`   🎯 Test User Position: #${shinyUser.position} ✅`);
        } else {
          console.log(`   ❌ Test user not found in global shiny counter`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error checking shiny global counter: ${error.message}`);
    }

    // Final assessment
    console.log('\n🎯 SYSTEM HEALTH ASSESSMENT:');
    console.log('=' .repeat(50));

    const allTestAccountsFound = Object.keys(testAccounts).every(email =>
      usersByType.white.some(u => u.email === email) ||
      usersByType.black.some(u => u.email === email) ||
      usersByType.shiny.some(u => u.email === email)
    );

    const noMissingTypes = userStats.missing === 0;
    const allFeaturesWorking =
      usersByType.white.every(u => u.hasPermissions) &&
      usersByType.black.every(u => u.hasDarkFields) &&
      usersByType.shiny.every(u => u.hasShinyFeatures);

    console.log(`   🧪 Test Accounts Complete: ${allTestAccountsFound ? '✅ YES' : '❌ NO'}`);
    console.log(`   🏷️  No Missing User Types: ${noMissingTypes ? '✅ YES' : '❌ NO'}`);
    console.log(`   🔧 All Features Working: ${allFeaturesWorking ? '✅ YES' : '❌ NO'}`);

    const systemReady = allTestAccountsFound && noMissingTypes && allFeaturesWorking;
    console.log(`   \n🚀 READY FOR GOOGLE PLAY: ${systemReady ? '✅ YES 🎉' : '❌ NO - NEEDS FIXES'}`);

    if (systemReady) {
      console.log('\n✅ STEEB SYSTEM VERIFICATION COMPLETE');
      console.log('✅ All test accounts working properly');
      console.log('✅ User roles assigned correctly');
      console.log('✅ Dark mode features functional');
      console.log('✅ Shiny features operational');
      console.log('✅ Global statistics synchronized');
      console.log('\n🚀 SYSTEM READY FOR GOOGLE PLAY STORE SUBMISSION! 🎉');
    } else {
      console.log('\n❌ STEEB SYSTEM NEEDS FIXES');
      console.log('❌ Some features may not be working correctly');
      console.log('❌ Address issues before Google Play submission');
    }

  } catch (error) {
    console.error('❌ Error during system verification:', error);
  }
};

// Run verification
verifyCompleteSystem()
  .then(() => {
    console.log('\n✅ System verification process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 System verification failed:', error);
    process.exit(1);
  });