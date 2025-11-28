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

const fixNewUsersWithoutTipoUsuario = async () => {
  console.log('🔧 Fixing new users without tipoUsuario...');

  // First, fix the specific user you mentioned
  const targetUserID = 'VBsnLGFfpVhq1C2Kh4o1jEXZqJv2';

  try {
    console.log(`\n👤 Checking user: ${targetUserID}`);

    // Get the specific user
    const userDoc = await db.collection('users').doc(targetUserID).get();

    if (!userDoc.exists) {
      console.log(`❌ User ${targetUserID} does not exist in Firestore`);
    } else {
      const userData = userDoc.data();
      console.log(`📧 Email: ${userData.email}`);
      console.log(`🏷️  Current tipoUsuario: "${userData.tipoUsuario || 'MISSING'}"`);
      console.log(`🎯 Current permissions: [${(userData.permissions || []).join(', ')}]`);

      // Check if tipoUsuario is missing
      if (!userData.tipoUsuario || userData.tipoUsuario === '') {
        console.log(`⚠️ User ${targetUserID} needs tipoUsuario assignment`);

        // Since it's a "shiny test" email, let's assign shiny role
        const userRef = db.collection('users').doc(targetUserID);
        await userRef.update({
          tipoUsuario: 'shiny',
          permissions: ['shiny_game', 'dark_mode', 'premium_features', 'exclusive_content'],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          shinyRolls: userData.shinyRolls !== undefined ? userData.shinyRolls : 50, // Give extra rolls for testing
          lastShinyAttemptAt: null
        });

        console.log(`✅ Fixed user ${targetUserID} with tipoUsuario: 'shiny'`);

        // Update global statistics
        const statsRef = db.collection('global_stats').doc('general_stats');
        await statsRef.update({
          '4_shinyUsers': admin.firestore.FieldValue.increment(1),
          '0_lastUpdated': admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Updated global statistics: +1 shiny user`);

        // Add to global shiny counter
        try {
          const shinyStatsRef = db.collection('global_stats').doc('shiny_users');
          const shinyStatsDoc = await shinyStatsRef.get();

          let currentStats;
          if (!shinyStatsDoc.exists) {
            currentStats = {
              totalShinyUsers: 0,
              shinyUsersList: []
            };
          } else {
            currentStats = shinyStatsDoc.data();
          }

          // Add user to shiny list
          const newShinyUser = {
            userId: targetUserID,
            userName: userData.email || 'Usuario Shiny Test',
            userAvatar: userData.avatar || null,
            unlockedAt: new Date().toISOString(),
            position: currentStats.totalShinyUsers + 1
          };

          const updatedList = [...currentStats.shinyUsersList, newShinyUser];
          const newTotal = currentStats.totalShinyUsers + 1;

          await shinyStatsRef.set({
            totalShinyUsers: newTotal,
            shinyUsersList: updatedList,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ Added user to global shiny counter at position #${newTotal}`);
        } catch (shinyError) {
          console.log(`⚠️ Error adding to shiny counter:`, shinyError.message);
        }

      } else {
        console.log(`✅ User ${targetUserID} already has tipoUsuario: "${userData.tipoUsuario}"`);
      }
    }

  } catch (error) {
    console.error(`❌ Error fixing user ${targetUserID}:`, error);
  }

  // Now check for other users with missing tipoUsuario
  console.log(`\n🔍 Checking for other users without tipoUsuario...`);

  const allUsersSnapshot = await db.collection('users').limit(50).get();

  const usersWithoutTipo = [];
  const userStats = {
    white: 0,
    black: 0,
    shiny: 0,
    missing: 0
  };

  allUsersSnapshot.forEach((doc) => {
    const userData = doc.data();
    const tipoUsuario = userData.tipoUsuario;

    if (!tipoUsuario || tipoUsuario === '' || tipoUsuario === undefined) {
      usersWithoutTipo.push({
        id: doc.id,
        email: userData.email || 'No email',
        createdAt: userData.createdAt?.toDate() || 'Unknown'
      });
      userStats.missing++;
    } else {
      switch (tipoUsuario.toLowerCase()) {
        case 'white':
          userStats.white++;
          break;
        case 'black':
        case 'dark':
          userStats.black++;
          break;
        case 'shiny':
          userStats.shiny++;
          break;
        default:
          userStats.missing++;
          break;
      }
    }
  });

  console.log(`\n📊 User statistics from checked users:`);
  console.log(`   ⚪ White users: ${userStats.white}`);
  console.log(`   ⚫ Black/Dark users: ${userStats.black}`);
  console.log(`   ✨ Shiny users: ${userStats.shiny}`);
  console.log(`   ❌ Missing tipoUsuario: ${userStats.missing}`);

  if (usersWithoutTipo.length > 0) {
    console.log(`\n🔧 Found ${usersWithoutTipo.length} users without tipoUsuario - fixing them...`);

    // Batch fix all users without tipoUsuario
    const batch = db.batch();

    usersWithoutTipo.forEach((user) => {
      const userRef = db.collection('users').doc(user.id);
      console.log(`👤 Fixing: ${user.email} (${user.id.substring(0, 8)}...)`);

      batch.update(userRef, {
        tipoUsuario: 'white',
        permissions: ['basic_features'],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });
    });

    await batch.commit();
    console.log(`✅ Fixed ${usersWithoutTipo.length} users with tipoUsuario: 'white'`);

    // Update global statistics
    const statsRef = db.collection('global_stats').doc('general_stats');
    await statsRef.update({
      '2_whiteUsers': admin.firestore.FieldValue.increment(usersWithoutTipo.length),
      '0_lastUpdated': admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Updated global statistics: +${usersWithoutTipo.length} white users`);
  } else {
    console.log(`\n✅ All checked users have tipoUsuario assigned properly!`);
  }

  // Final verification of the target user
  console.log(`\n🔍 Final verification of ${targetUserID}...`);

  try {
    const finalUserDoc = await db.collection('users').doc(targetUserID).get();
    if (finalUserDoc.exists) {
      const finalData = finalUserDoc.data();
      console.log(`✅ Final state:`);
      console.log(`   📧 Email: ${finalData.email}`);
      console.log(`   🏷️  tipoUsuario: "${finalData.tipoUsuario}"`);
      console.log(`   🎯 Permissions: [${(finalData.permissions || []).join(', ')}]`);
      console.log(`   🍬 Shiny Rolls: ${finalData.shinyRolls || 0}`);
      console.log(`   🔥 Is Active: ${finalData.isActive}`);
    }
  } catch (error) {
    console.error(`❌ Error in final verification:`, error);
  }

  console.log(`\n🎉 User fixing process completed!`);
};

// Run the function
fixNewUsersWithoutTipoUsuario()
  .then(() => {
    console.log('\n✅ All fixes completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fix process failed:', error);
    process.exit(1);
  });