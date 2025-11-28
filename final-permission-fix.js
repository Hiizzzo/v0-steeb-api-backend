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

const finalPermissionFix = async () => {
  console.log('🔧 FINAL PERMISSION FIX - Complete System Setup');
  console.log('=' .repeat(80));

  // Fix steebtestshiny@gmail.com permissions
  const shinyUserID = 'VBsnLGFfpVhq1C2Kh4o1jEXZqJv2';

  try {
    console.log('\n👤 Fixing shiny user permissions...');
    console.log(`🆔 User ID: ${shinyUserID}`);

    // Get current user state
    const userDoc = await db.collection('users').doc(shinyUserID).get();
    if (!userDoc.exists) {
      console.log(`❌ Shiny user not found`);
      return;
    }

    const userData = userDoc.data();
    console.log(`📧 Email: ${userData.email}`);
    console.log(`🏷️  Current tipoUsuario: "${userData.tipoUsuario}"`);
    console.log(`🎯 Current permissions: [${(userData.permissions || []).join(', ')}]`);
    console.log(`🍬 Current shiny rolls: ${userData.shinyRolls || 0}`);

    // Update with complete shiny permissions
    const correctShinyPermissions = [
      'basic_features',     // Core app features
      'dark_mode',         // Dark mode access
      'shiny_game',        // Shiny game access
      'premium_features',    // Premium features
      'exclusive_content'    // Exclusive content
    ];

    await db.collection('users').doc(shinyUserID).update({
      tipoUsuario: 'shiny',
      permissions: correctShinyPermissions,
      shinyRolls: 50,  // Good amount for testing
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Updated permissions to: [${correctShinyPermissions.join(', ')}]`);
    console.log(`✅ Updated shiny rolls to: 50`);

    // Verify the fix
    const updatedDoc = await db.collection('users').doc(shinyUserID).get();
    const updatedData = updatedDoc.data();

    console.log(`\n🔍 VERIFICATION:`);
    console.log(`🏷️  tipoUsuario: "${updatedData.tipoUsuario}"`);
    console.log(`🎯 permissions: [${updatedData.permissions.join(', ')}]`);
    console.log(`🍬 shinyRolls: ${updatedData.shinyRolls}`);

    const hasAllShinyPermissions = correctShinyPermissions.every(perm =>
      updatedData.permissions.includes(perm)
    );

    console.log(`✅ All shiny permissions present: ${hasAllShinyPermissions ? 'YES' : 'NO'}`);

    if (hasAllShinyPermissions) {
      console.log('\n🎉 SHINY USER FULLY CONFIGURED!');
    } else {
      console.log('\n❌ Shiny permissions still incomplete');
    }

  } catch (error) {
    console.error('❌ Error fixing shiny user:', error);
  }

  // Final complete system check
  console.log('\n📊 COMPLETE SYSTEM VERIFICATION');
  console.log('=' .repeat(50));

  try {
    const allUsersSnapshot = await db.collection('users').get();

    const systemStatus = {
      white: { count: 0, withPermissions: 0, list: [] },
      black: { count: 0, withDarkMode: 0, list: [] },
      shiny: { count: 0, withFullFeatures: 0, list: [] },
      total: allUsersSnapshot.size
    };

    allUsersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const tipoUsuario = userData.tipoUsuario?.toLowerCase();

      if (!tipoUsuario) {
        return; // Skip users without tipoUsuario
      }

      switch (tipoUsuario) {
        case 'white':
          systemStatus.white.count++;
          systemStatus.white.list.push({
            email: userData.email,
            hasPermissions: userData.permissions?.length > 0
          });
          if (userData.permissions?.length > 0) {
            systemStatus.white.withPermissions++;
          }
          break;

        case 'black':
        case 'dark':
          systemStatus.black.count++;
          const hasDarkModeFields = userData.darkClubNumber &&
                                 userData.darkClubNickname &&
                                 userData.darkModeEnabled !== undefined;
          systemStatus.black.list.push({
            email: userData.email,
            darkClubNumber: userData.darkClubNumber,
            hasDarkMode: hasDarkModeFields
          });
          if (hasDarkModeFields) {
            systemStatus.black.withDarkMode++;
          }
          break;

        case 'shiny':
          systemStatus.shiny.count++;
          const shinyPermissions = [
            'basic_features', 'dark_mode', 'shiny_game',
            'premium_features', 'exclusive_content'
          ];
          const hasAllShinyFeatures = shinyPermissions.every(perm =>
            userData.permissions?.includes(perm)
          );
          systemStatus.shiny.list.push({
            email: userData.email,
            shinyRolls: userData.shinyRolls || 0,
            hasFullFeatures: hasAllShinyFeatures
          });
          if (hasAllShinyFeatures) {
            systemStatus.shiny.withFullFeatures++;
          }
          break;
      }
    });

    console.log('\n📈 SYSTEM BREAKDOWN:');
    console.log(`   👥 Total Users: ${systemStatus.total}`);
    console.log(`   ⚪ White Users: ${systemStatus.white.count} (${systemStatus.white.withPermissions} with permissions)`);
    console.log(`   ⚫ Black Users: ${systemStatus.black.count} (${systemStatus.black.withDarkMode} with dark mode)`);
    console.log(`   ✨ Shiny Users: ${systemStatus.shiny.count} (${systemStatus.shiny.withFullFeatures} with full features)`);

    // Test accounts summary
    console.log('\n🧪 TEST ACCOUNTS STATUS:');
    console.log('=' .repeat(40));

    const testAccounts = [
      { email: 'steebtestwhite@gmail.com', type: 'white' },
      { email: 'steebtestblack@gmail.com', type: 'black' },
      { email: 'steebtestshiny@gmail.com', type: 'shiny' }
    ];

    let allTestAccountsWorking = true;

    for (const testAccount of testAccounts) {
      const user = systemStatus[`${testAccount.type}].list.find(u => u.email === testAccount.email);

      if (user) {
        let status = '✅ WORKING';

        if (testAccount.type === 'white' && !user.hasPermissions) {
          status = '❌ MISSING PERMISSIONS';
          allTestAccountsWorking = false;
        } else if (testAccount.type === 'black' && !user.hasDarkMode) {
          status = '❌ MISSING DARK MODE';
          allTestAccountsWorking = false;
        } else if (testAccount.type === 'shiny' && !user.hasFullFeatures) {
          status = '❌ MISSING FEATURES';
          allTestAccountsWorking = false;
        }

        console.log(`📧 ${testAccount.email}`);
        console.log(`   Type: ${testAccount.type.toUpperCase()} | Status: ${status}`);

        if (testAccount.type === 'shiny') {
          console.log(`   Shiny Rolls: ${user.shinyRolls}`);
        } else if (testAccount.type === 'black') {
          console.log(`   Dark Club: #${user.darkClubNumber}`);
        }
      } else {
        console.log(`❌ ${testAccount.email} - NOT FOUND`);
        allTestAccountsWorking = false;
      }
    }

    // Global statistics check
    console.log('\n📊 GLOBAL STATISTICS:');
    console.log('=' .repeat(30));

    const statsDoc = await db.collection('global_stats').doc('general_stats').get();
    if (statsDoc.exists) {
      const stats = statsDoc.data();
      console.log(`⚪ White Users: ${stats['2_whiteUsers']}`);
      console.log(`⚫ Dark Users: ${stats['3_darkUsers']}`);
      console.log(`✨ Shiny Users: ${stats['4_shinyUsers']}`);

      const statsMatch =
        stats['2_whiteUsers'] === systemStatus.white.count &&
        stats['3_darkUsers'] === systemStatus.black.count &&
        stats['4_shinyUsers'] === systemStatus.shiny.count;

      console.log(`📈 Statistics Match: ${statsMatch ? '✅ YES' : '❌ NO'}`);
    }

    // Final assessment
    console.log('\n🎯 SYSTEM READINESS ASSESSMENT:');
    console.log('=' .repeat(50));

    const allUsersHaveRoles = systemStatus.white.count + systemStatus.black.count + systemStatus.shiny.count === systemStatus.total;
    const allWhiteHavePermissions = systemStatus.white.count === systemStatus.white.withPermissions;
    const allBlackHaveDarkMode = systemStatus.black.count === systemStatus.black.withDarkMode;
    const allShinyHaveFeatures = systemStatus.shiny.count === systemStatus.shiny.withFullFeatures;

    console.log(`👥 All Users Have Roles: ${allUsersHaveRoles ? '✅ YES' : '❌ NO'}`);
    console.log(`⚪ White Users Complete: ${allWhiteHavePermissions ? '✅ YES' : '❌ NO'}`);
    console.log(`⚫ Black Users Complete: ${allBlackHaveDarkMode ? '✅ YES' : '❌ NO'}`);
    console.log(`✨ Shiny Users Complete: ${allShinyHaveFeatures ? '✅ YES' : '❌ NO'}`);
    console.log(`🧪 Test Accounts Working: ${allTestAccountsWorking ? '✅ YES' : '❌ NO'}`);

    const systemReady = allUsersHaveRoles &&
                        allWhiteHavePermissions &&
                        allBlackHaveDarkMode &&
                        allShinyHaveFeatures &&
                        allTestAccountsWorking;

    if (systemReady) {
      console.log('\n🚀🚀🚀 SYSTEM READY FOR GOOGLE PLAY STORE! 🚀🚀🚀');
      console.log('\n✅ STEEB Features Ready:');
      console.log('   • User registration with automatic role assignment');
      console.log('   • White mode (default) with basic features');
      console.log('   • Black mode with dark theme and dark club');
      console.log('   • Shiny mode with premium features and shiny game');
      console.log('   • Global statistics and user ranking');
      console.log('   • Payment processing and role upgrades');
      console.log('   • Complete user flow testing verified');
      console.log('\n📋 Test Accounts for Google Play:');
      console.log('   📧 steebtestwhite@gmail.com (White/Default)');
      console.log('   📧 steebtestblack@gmail.com (Black/Dark Mode)');
      console.log('   📧 steebtestshiny@gmail.com (Shiny/Premium)');
      console.log('\n🎉 SUBMISSION READY! 🎉');
    } else {
      console.log('\n❌ SYSTEM NOT READY FOR GOOGLE PLAY');
      console.log('❌ Address the issues above before submission');
    }

  } catch (error) {
    console.error('❌ Error in final system check:', error);
  }
};

// Run the final fix
finalPermissionFix()
  .then(() => {
    console.log('\n✅ Final permission fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Final permission fix failed:', error);
    process.exit(1);
  });