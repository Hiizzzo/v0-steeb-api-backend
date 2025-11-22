// Actualizar usuario existente a tipoUsuario: dark
import 'dotenv/config';
import { db, getUserFromFirestore, updateUserTipo } from './lib/firebase.js';

const findAndUpdateUserToDark = async () => {
  console.log('🔍 Buscando usuario existente para actualizar a DARK...');
  console.log('');

  try {
    // 1. Buscar usuario por email del pago
    const email = 'elgrancreador8@gmail.com';
    console.log(`📧 Buscando usuario con email: ${email}`);

    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log(`❌ No se encontró usuario con email: ${email}`);

      // Buscar por otros métodos
      console.log('🔍 Buscando todos los usuarios...');
      const allUsersSnapshot = await db.collection('users').limit(10).get();

      if (allUsersSnapshot.empty) {
        console.log('❌ No hay usuarios en la base de datos');
        return;
      }

      console.log('📋 Usuarios encontrados:');
      allUsersSnapshot.docs.forEach((doc, index) => {
        const userData = doc.data();
        console.log(`  ${index + 1}. ID: ${doc.id}`);
        console.log(`     Email: ${userData.email || 'Sin email'}`);
        console.log(`     TipoUsuario: ${userData.tipoUsuario || 'white'}`);
        console.log('');
      });

      console.log('🎯 ¿Cuál de estos usuarios quieres actualizar a dark mode?');
      console.log('💡 O dime el email o ID del usuario correcto');

      return;
    }

    // 2. Obtener el usuario encontrado
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`✅ Usuario encontrado: ${userId}`);
    console.log(`📋 Estado actual:`);
    console.log(`   - ID: ${userId}`);
    console.log(`   - Email: ${userData.email}`);
    console.log(`   - TipoUsuario actual: ${userData.tipoUsuario || 'white'}`);
    console.log(`   - Permisos actuales: ${JSON.stringify(userData.permissions || [])}`);

    // 3. Actualizar solo el tipoUsuario a dark
    console.log(`\n🔄 Actualizando tipoUsuario a: dark`);

    await updateUserTipo(
      userId,
      'dark',
      ['dark_mode', 'basic_features']
    );

    console.log(`✅ ¡Usuario actualizado exitosamente a DARK!`);

    // 4. Verificar la actualización
    const updatedUser = await getUserFromFirestore(userId);
    if (updatedUser) {
      console.log(`\n🎯 Verificación final:`);
      console.log(`   - ID: ${updatedUser.id}`);
      console.log(`   - Email: ${updatedUser.email}`);
      console.log(`   - TipoUsuario: ${updatedUser.tipoUsuario}`);
      console.log(`   - Permisos: ${JSON.stringify(updatedUser.permissions)}`);
    }

  } catch (error) {
    console.error('❌ Error actualizando usuario:', error.message);
  }
};

findAndUpdateUserToDark();