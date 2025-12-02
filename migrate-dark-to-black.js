import { db } from './lib/firebase.js';

/**
 * Script para migrar usuarios de tipoUsuario 'dark' a 'black'
 */
async function migrateDarkToBlack() {
    console.log('🔄 Iniciando migración de dark → black...');

    try {
        // Obtener todos los usuarios con tipoUsuario 'dark'
        const usersSnapshot = await db.collection('users')
            .where('tipoUsuario', '==', 'dark')
            .get();

        if (usersSnapshot.empty) {
            console.log('✅ No hay usuarios con tipoUsuario "dark" para migrar.');
            return;
        }

        console.log(`📊 Encontrados ${usersSnapshot.size} usuarios con tipoUsuario "dark"`);

        // Actualizar cada usuario
        const batch = db.batch();
        let count = 0;

        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            console.log(`  - Migrando usuario: ${userData.email || doc.id}`);

            batch.update(doc.ref, {
                tipoUsuario: 'black',
                updatedAt: new Date()
            });

            count++;
        });

        // Ejecutar todas las actualizaciones
        await batch.commit();

        console.log(`✅ Migración completada. ${count} usuarios actualizados de "dark" a "black".`);

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        throw error;
    }
}

// Ejecutar migración
migrateDarkToBlack()
    .then(() => {
        console.log('🎉 Proceso completado exitosamente.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
