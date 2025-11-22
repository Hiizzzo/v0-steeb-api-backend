// Script para actualizar el usuario theblexiz3010@gmail.com a tipoUsuario: black
// Una vez que configures las credenciales de Firebase en .env, puedes ejecutar este script

import 'dotenv/config';
import { db, updateUserTipo, getUserFromFirestore } from './lib/firebase.js';

const EMAIL = 'theblexiz3010@gmail.com';
const TARGET_TIPO = 'black';
const TARGET_PERMISSIONS = ['dark_mode', 'basic_features'];

async function updateUserToBlack() {
  console.log('🚀 Actualizando usuario real a tipoUsuario: black...');
  console.log(`📧 Email objetivo: ${EMAIL}`);

  try {
    // 1. Buscar usuario por email
    console.log('\n🔍 Paso 1: Buscando usuario por email...');
    const usersSnapshot = await db.collection('users')
      .where('email', '==', EMAIL)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log(`❌ Usuario con email ${EMAIL} no encontrado`);
      console.log('💡 Creando nuevo usuario...');

      // Crear usuario si no existe
      const userId = `user_${Date.now()}`;
      await db.collection('users').doc(userId).set({
        id: userId,
        email: EMAIL,
        tipoUsuario: TARGET_TIPO,
        permissions: TARGET_PERMISSIONS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastPayment: null,
        isActive: true
      });

      console.log(`✅ Nuevo usuario creado: ${userId}`);
      console.log(`🎯 TipoUsuario: ${TARGET_TIPO}`);
      console.log(`🔑 Permisos: ${JSON.stringify(TARGET_PERMISSIONS)}`);
      return;
    }

    // 2. Obtener datos del usuario existente
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const currentData = userDoc.data();

    console.log(`✅ Usuario encontrado: ${userId}`);
    console.log(`📋 Estado actual:`);
    console.log(`   - Email: ${currentData.email}`);
    console.log(`   - TipoUsuario actual: ${currentData.tipoUsuario || 'white'}`);
    console.log(`   - Permisos actuales: ${JSON.stringify(currentData.permissions || [])}`);

    // 3. Actualizar a tipoUsuario: black
    console.log(`\n🔄 Paso 2: Actualizando a tipoUsuario: ${TARGET_TIPO}...`);

    await updateUserTipo(userId, TARGET_TIPO, TARGET_PERMISSIONS);

    console.log(`✅ TipoUsuario actualizado con éxito`);

    // 4. Verificar la actualización
    console.log('\n🔍 Paso 3: Verificando actualización...');
    const updatedUser = await getUserFromFirestore(userId);

    if (updatedUser) {
      console.log(`✅ Verificación exitosa:`);
      console.log(`   - ID: ${updatedUser.id}`);
      console.log(`   - Email: ${updatedUser.email}`);
      console.log(`   - TipoUsuario: ${updatedUser.tipoUsuario}`);
      console.log(`   - Permisos: ${JSON.stringify(updatedUser.permissions)}`);
      console.log(`   - Actualizado: ${updatedUser.updatedAt}`);

      // 5. Verificar acceso a features
      console.log('\n🎮 Verificación de acceso a features:');

      const features = {
        'dark_mode': updatedUser.permissions.includes('dark_mode'),
        'shiny_game': updatedUser.permissions.includes('shiny_game'),
        'premium_features': updatedUser.permissions.includes('premium_features'),
        'exclusive_content': updatedUser.permissions.includes('exclusive_content'),
        'basic_features': updatedUser.permissions.includes('basic_features')
      };

      Object.entries(features).forEach(([feature, hasAccess]) => {
        const status = hasAccess ? '✅' : '❌';
        console.log(`   ${status} ${feature}: ${hasAccess ? 'PERMITIDO' : 'DENEGADO'}`);
      });

      console.log('\n🎉 ¡Usuario actualizado exitosamente!');
      console.log(`📧 ${EMAIL} ahora es un usuario ${TARGET_TIPO.toUpperCase()}`);

    } else {
      console.log(`❌ Error al verificar la actualización`);
    }

  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
    console.error('Detalles:', error.message);

    // Detectar errores comunes
    if (error.message.includes('FIREBASE')) {
      console.log('\n💡 Solución: Verifica que las variables de Firebase estén configuradas en .env');
    } else if (error.message.includes('permission-denied')) {
      console.log('\n💡 Solución: Verifica que la cuenta de servicio de Firebase tenga permisos de escritura');
    }
  }
}

// Ejecutar el script
updateUserToBlack()
  .then(() => {
    console.log('\n✨ Script completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });