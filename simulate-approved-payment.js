import 'dotenv/config';
import { persistPaymentFromMercadoPago } from './server.js';
import { db, createUserInFirestore, getUserFromFirestore } from './lib/firebase.js';

async function simulateApprovedPayment() {
    console.log('🧪 Iniciando SIMULACIÓN de pago aprobado...');

    // 1. Crear un usuario de prueba en Firebase
    // Usamos un ID sin guiones bajos para evitar confusiones, aunque el backend ya lo soporta
    const testUserId = `testuser${Date.now()}`;
    console.log(`\n👤 Creando usuario de prueba: ${testUserId}`);

    await createUserInFirestore({
        id: testUserId,
        email: 'test@simulation.com',
        tipoUsuario: 'white',
        permissions: ['basic_features']
    });

    // 2. Crear un objeto de pago falso (como el que manda Mercado Pago)
    const fakePayment = {
        id: 123456789,
        status: 'approved', // <--- CLAVE: Simulamos que está aprobado
        status_detail: 'accredited',
        transaction_amount: 100,
        currency_id: 'ARS',
        date_created: new Date().toISOString(),
        date_approved: new Date().toISOString(),
        payer: { email: 'payer@test.com' },
        external_reference: `black-user-plan_${testUserId}_${Date.now()}`, // <--- CLAVE: Tiene el ID del usuario
        order: { id: 'pref_123' }
    };

    console.log('\n💰 Inyectando pago falso en el sistema...');
    console.log(`   Referencia: ${fakePayment.external_reference}`);

    try {
        // 3. Ejecutar la lógica REAL del backend
        await persistPaymentFromMercadoPago(fakePayment);
        console.log('✅ Lógica de backend ejecutada sin errores.');

        // 4. Verificar en la base de datos
        console.log('\n🔍 Verificando actualización en Firebase...');
        const updatedUser = await getUserFromFirestore(testUserId);

        if (updatedUser.tipoUsuario === 'black') {
            console.log('🎉 ¡ÉXITO TOTAL! El usuario pasó de WHITE a BLACK automáticamente.');
            console.log(`   Estado final: ${updatedUser.tipoUsuario}`);
            console.log(`   Permisos: ${JSON.stringify(updatedUser.permissions)}`);
        } else {
            console.error('❌ FALLÓ: El usuario sigue siendo', updatedUser.tipoUsuario);
        }

    } catch (error) {
        console.error('❌ Error en la simulación:', error);
    }

    // Limpieza (opcional)
    // await db.collection('users').doc(testUserId).delete();
}

simulateApprovedPayment();
