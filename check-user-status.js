// Verificar estado actual del usuario
import 'dotenv/config';
import { getUserFromFirestore } from './lib/firebase.js';
import { db } from './lib/firebase.js';

const checkUserStatus = async (email) => {
  console.log(`🔍 Verificando estado del usuario: ${email}`);

  try {
    // Buscar usuario por email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log(`❌ Usuario con email ${email} no encontrado`);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`✅ Usuario encontrado: ${userId}`);
    console.log(`📋 Estado actual:`);
    console.log(`   - ID: ${userData.id}`);
    console.log(`   - Email: ${userData.email}`);
    console.log(`   - TipoUsuario: ${userData.tipoUsuario || 'white'}`);
    console.log(`   - Shiny Rolls: ${userData.shinyRolls || 0}`);
    console.log(`   - Permisos: ${JSON.stringify(userData.permissions || [])}`);
    console.log(`   - Activo: ${userData.isActive}`);
    console.log(`   - Último pago: ${userData.lastPayment || 'Ninguno'}`);
    console.log(`   - Actualizado: ${userData.updatedAt}`);

    // Verificar acceso a features
    console.log(`\n🎮 Acceso a features:`);
    const features = {
      'dark_mode': userData.permissions?.includes('dark_mode') || false,
      'shiny_game': userData.permissions?.includes('shiny_game') || false,
      'premium_features': userData.permissions?.includes('premium_features') || false,
      'basic_features': userData.permissions?.includes('basic_features') || false
    };

    Object.entries(features).forEach(([feature, hasAccess]) => {
      const status = hasAccess ? '✅' : '❌';
      console.log(`   ${status} ${feature}: ${hasAccess ? 'PERMITIDO' : 'DENEGADO'}`);
    });

    return userData;

  } catch (error) {
    console.error('❌ Error verificando usuario:', error.message);
    return null;
  }
};

// Verificar usuario
checkUserStatus('theblexiz3010@gmail.com');