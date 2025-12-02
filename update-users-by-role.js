import { db } from './lib/firebase.js';

/**
 * Script para crear/actualizar la colección usersByRole en Firebase
 * Esto permite ver fácilmente usuarios agrupados por tipoUsuario en Firebase Console
 */
async function updateUsersByRole() {
    console.log('🔄 Actualizando usersByRole...');

    try {
        // Obtener todos los usuarios
        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log('⚠️ No hay usuarios en la base de datos.');
            return;
        }

        // Agrupar usuarios por tipoUsuario
        const groupedUsers = {
            white: [],
            black: [],
            shiny: []
        };

        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            const tipoUsuario = userData.tipoUsuario || 'white';

            const userInfo = {
                uid: doc.id,
                email: userData.email || 'sin email',
                name: userData.name || 'sin nombre',
                nickname: userData.nickname || '',
                createdAt: userData.createdAt?.toDate?.() || new Date(),
                avatar: userData.avatar || null
            };

            if (groupedUsers[tipoUsuario]) {
                groupedUsers[tipoUsuario].push(userInfo);
            }
        });

        // Ordenar por fecha de creación (más recientes primero)
        Object.keys(groupedUsers).forEach(role => {
            groupedUsers[role].sort((a, b) => b.createdAt - a.createdAt);
        });

        // Actualizar documentos en Firebase
        const usersByRoleRef = db.collection('usersByRole');

        for (const [role, users] of Object.entries(groupedUsers)) {
            await usersByRoleRef.doc(role).set({
                role: role,
                count: users.length,
                users: users,
                lastUpdated: new Date()
            });

            console.log(`✅ ${role.toUpperCase()}: ${users.length} usuarios`);
            users.forEach(u => {
                console.log(`   - ${u.email} (${u.name || 'sin nombre'})`);
            });
        }

        console.log('');
        console.log('📊 Resumen:');
        console.log(`   White: ${groupedUsers.white.length} usuarios`);
        console.log(`   Black: ${groupedUsers.black.length} usuarios`);
        console.log(`   Shiny: ${groupedUsers.shiny.length} usuarios`);
        console.log(`   TOTAL: ${usersSnapshot.size} usuarios`);

    } catch (error) {
        console.error('❌ Error actualizando usersByRole:', error);
        throw error;
    }
}

// Ejecutar actualización
updateUsersByRole()
    .then(() => {
        console.log('');
        console.log('🎉 Proceso completado.');
        console.log('💡 Ahora podés ver los usuarios agrupados en Firebase Console:');
        console.log('   Firestore → usersByRole → (white/black/shiny)');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
