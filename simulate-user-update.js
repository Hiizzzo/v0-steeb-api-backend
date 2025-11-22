import 'dotenv/config';
import { db, updateUserTipo, getUserFromFirestore } from './lib/firebase.js';

const EMAIL = 'theblexiz3010@gmail.com';
const TARGET_TIPO = 'black';
const TARGET_PERMISSIONS = ['dark_mode', 'basic_features'];

async function simulateDatabaseUpdate() {
  console.log('🚀 Iniciando simulación de actualización de base de datos...');
  console.log(`📧 Email objetivo: ${EMAIL}`);
  console.log(`🎯 TipoUsuario a asignar: ${TARGET_TIPO}`);

  try {
    // 1. Buscar usuario por email
    console.log('\n🔍 Paso 1: Buscando usuario por email...');
    const usersSnapshot = await db.collection('users')
      .where('email', '==', EMAIL)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log(`❌ Usuario con email ${EMAIL} no encontrado`);
      console.log('💡 Creando usuario simulado...');

      // Crear usuario simulado con ID único
      const userId = `sim_user_${Date.now()}`;
      const newUser = {
        id: userId,
        email: EMAIL,
        tipoUsuario: TARGET_TIPO,
        permissions: TARGET_PERMISSIONS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastPayment: null,
        isActive: true
      };

      await db.collection('users').doc(userId).set(newUser);
      console.log(`✅ Usuario creado con éxito: ${userId}`);
      console.log(`📋 Datos del nuevo usuario:`);
      console.log(`   - ID: ${userId}`);
      console.log(`   - Email: ${EMAIL}`);
      console.log(`   - TipoUsuario: ${TARGET_TIPO}`);
      console.log(`   - Permisos: ${JSON.stringify(TARGET_PERMISSIONS)}`);

      return;
    }

    // 2. Si el usuario existe, obtener sus datos actuales
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const currentData = userDoc.data();

    console.log(`✅ Usuario encontrado: ${userId}`);
    console.log(`📋 Estado actual:`);
    console.log(`   - Email: ${currentData.email}`);
    console.log(`   - TipoUsuario actual: ${currentData.tipoUsuario || 'white'}`);
    console.log(`   - Permisos actuales: ${JSON.stringify(currentData.permissions || [])}`);

    // 3. Actualizar el tipoUsuario
    console.log(`\n🔄 Paso 2: Actualizando tipoUsuario a ${TARGET_TIPO}...`);

    await updateUserTipo(userId, TARGET_TIPO, TARGET_PERMISSIONS);

    console.log(`✅ TipoUsuario actualizado con éxito`);

    // 4. Verificar la actualización
    console.log('\n🔍 Paso 3: Verificando la actualización...');
    const updatedUser = await getUserFromFirestore(userId);

    if (updatedUser) {
      console.log(`✅ Verificación exitosa:`);
      console.log(`   - ID: ${updatedUser.id}`);
      console.log(`   - Email: ${updatedUser.email}`);
      console.log(`   - TipoUsuario: ${updatedUser.tipoUsuario}`);
      console.log(`   - Permisos: ${JSON.stringify(updatedUser.permissions)}`);
      console.log(`   - Actualizado: ${updatedUser.updatedAt}`);

      // 5. Simular acceso a features
      console.log('\n🎮 Paso 4: Simulando acceso a features...');

      if (updatedUser.tipoUsuario === 'black') {
        console.log(`🌓 ✅ Tiene acceso a DARK MODE`);
        console.log(`🎯 ✅ Tiene acceso a BASIC FEATURES`);
      }

      if (updatedUser.permissions.includes('dark_mode')) {
        console.log(`🎨 ✅ Permiso DARK_MODE activado`);
      }

    } else {
      console.log(`❌ Error al verificar la actualización`);
    }

  } catch (error) {
    console.error('❌ Error en la simulación:', error);
    console.error('Detalles del error:', error.message);
  }
}

// Ejecutar la simulación
simulateDatabaseUpdate().then(() => {
  console.log('\n🎉 Simulación completada');
  process.exit(0);
}).catch(error => {
  console.error('💥 Error fatal en la simulación:', error);
  process.exit(1);
});