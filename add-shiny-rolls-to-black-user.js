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

const addShinyRollsToBlackUser = async () => {
  console.log('🎰 Adding 100 Shiny Rolls to Test Black User');
  console.log('=' .repeat(80));

  const targetEmail = 'steebtestblack@gmail.com';
  const shinyRollsToAdd = 100;

  try {
    // Find the user by email
    console.log('\n👤 Finding user: ' + targetEmail);

    const usersSnapshot = await db.collection('users')
      .where('email', '==', targetEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ User not found: ' + targetEmail);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userID = userDoc.id;
    const userData = userDoc.data();

    console.log('🆔 User ID: ' + userID);
    console.log('📧 Email: ' + userData.email);
    console.log('🏷️  Current tipoUsuario: "' + userData.tipoUsuario + '"');
    console.log('🎯 Current permissions: [' + ((userData.permissions || []).join(', ')) + ']');
    console.log('🍬 Current shiny rolls: ' + (userData.shinyRolls || 0));

    // Add 100 shiny rolls to the user
    console.log('\n🎲 Adding ' + shinyRollsToAdd + ' shiny rolls...');

    await db.collection('users').doc(userID).update({
      shinyRolls: admin.firestore.FieldValue.increment(shinyRollsToAdd),
      lastShinyRollAddedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Successfully added ' + shinyRollsToAdd + ' shiny rolls!');

    // Verify the addition
    const updatedDoc = await db.collection('users').doc(userID).get();
    const updatedData = updatedDoc.data();

    console.log('\n🔍 VERIFICATION:');
    console.log('🍬 New shiny rolls total: ' + updatedData.shinyRolls);
    console.log('📅 Last updated: ' + updatedData.updatedAt?.toDate());

    // Check if user has shiny game permissions
    const hasShinyGamePermission = updatedData.permissions?.includes('shiny_game');

    if (!hasShinyGamePermission) {
      console.log('\n🔧 User missing shiny_game permission - adding it...');

      // Update permissions to include shiny_game access
      const currentPermissions = updatedData.permissions || [];
      const updatedPermissions = [...currentPermissions, 'shiny_game'];

      await db.collection('users').doc(userID).update({
        permissions: updatedPermissions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Added shiny_game permission');
      console.log('🎯 Updated permissions: [' + updatedPermissions.join(', ') + ']');
    } else {
      console.log('\n✅ User already has shiny_game permission');
    }

    // Final verification
    const finalDoc = await db.collection('users').doc(userID).get();
    const finalData = finalDoc.data();

    console.log('\n🎯 FINAL USER STATE:');
    console.log('📧 Email: ' + finalData.email);
    console.log('🏷️  tipoUsuario: "' + finalData.tipoUsuario + '"');
    console.log('🎯 Permissions: [' + finalData.permissions.join(', ') + ']');
    console.log('🍬 Shiny Rolls: ' + finalData.shinyRolls);
    console.log('🔥 Is Active: ' + (finalData.isActive !== undefined ? finalData.isActive : 'Unknown'));

    // Check access to shiny game
    const canPlayShinyGame = finalData.permissions?.includes('shiny_game');
    const hasEnoughRolls = finalData.shinyRolls >= 1;

    console.log('\n🎮 SHINY GAME ACCESS:');
    console.log('   ✅ Has shiny_game permission: ' + (canPlayShinyGame ? 'YES' : 'NO'));
    console.log('   ✅ Has shiny rolls: ' + (hasEnoughRolls ? 'YES (' + finalData.shinyRolls + ')' : 'NO'));
    console.log('   ✅ Can play shiny game: ' + (canPlayShinyGame && hasEnoughRolls ? 'YES! 🎉' : 'NO ❌'));

    if (canPlayShinyGame && hasEnoughRolls) {
      console.log('\n🎉 USER READY FOR SHINY GAME!');
      console.log('🎰 Can attempt ' + finalData.shinyRolls + ' times');
      console.log('🎮 Has access to all shiny game features');
      console.log('🏆 Can achieve shiny status and join rankings');
      console.log('\n📋 INSTRUCTIONS FOR TESTING:');
      console.log('1. Open STEEB app');
      console.log('2. Go to shiny game section');
      console.log('3. Use one shiny roll to play');
      console.log('4. Try to achieve shiny status');
      console.log('5. Test different shiny game mechanics');
      console.log('6. Verify global ranking updates');
    }

  } catch (error) {
    console.error('❌ Error adding shiny rolls:', error);
    throw error;
  }
};

// Run the function
addShinyRollsToBlackUser()
  .then(() => {
    console.log('\n✅ Shiny rolls addition completed successfully');
    console.log('🎮 User steebtestblack@gmail.com is ready for shiny game testing!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Shiny rolls addition failed:', error);
    process.exit(1);
  });