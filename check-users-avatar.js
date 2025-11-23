// Verificar estructura de usuarios y campo avatar
import 'dotenv/config';
import { db } from './lib/firebase.js';

const checkUsersWithAvatar = async () => {
  console.log('🔍 Verificando estructura de usuarios y campo avatar...');
  console.log('');

  try {
    // Obtener todos los usuarios
    const usersSnapshot = await db.collection('users').limit(20).get();

    if (usersSnapshot.empty) {
      console.log('❌ No hay usuarios en la base de datos');
      return;
    }

    console.log(`📋 Usuarios encontrados: ${usersSnapshot.size}`);
    console.log('');

    usersSnapshot.docs.forEach((doc, index) => {
      const userData = doc.data();

      console.log(`👤 Usuario #${index + 1}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Email: ${userData.email || 'No email'}`);
      console.log(`   TipoUsuario: ${userData.tipoUsuario || 'white'}`);
      console.log(`   🖼️ Avatar: ${userData.avatar || '❌ Sin avatar'}`);
      console.log(`   📝 DisplayName: ${userData.displayName || 'No name'}`);
      console.log(`   🔑 Permisos: ${JSON.stringify(userData.permissions || [])}`);
      console.log('');
    });

    // Contar cuántos tienen avatar
    const usersWithAvatar = usersSnapshot.docs.filter(doc =>
      doc.data().avatar && doc.data().avatar.trim() !== ''
    );

    console.log(`📊 Estadísticas:`);
    console.log(`   Total usuarios: ${usersSnapshot.size}`);
    console.log(`   Usuarios con avatar: ${usersWithAvatar.length}`);
    console.log(`   Usuarios sin avatar: ${usersSnapshot.size - usersWithAvatar.length}`);

    if (usersWithAvatar.length > 0) {
      console.log(`\n✅ ¡Hay ${usersWithAvatar.length} usuarios con avatar!`);
      console.log('🎯 El webhook puede identificar usuarios por avatar');
    } else {
      console.log(`\n⚠️ Ningún usuario tiene avatar configurado`);
      console.log('💡 El avatar debe ser guardado cuando el usuario se registra o actualiza su perfil');
    }

  } catch (error) {
    console.error('❌ Error verificando usuarios:', error.message);
  }
};

checkUsersWithAvatar();