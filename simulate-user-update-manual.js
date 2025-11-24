import 'dotenv/config';
import { processApprovedPayment } from './api/payments/webhook.js';

async function run() {
    console.log('🚀 Iniciando simulación manual para el usuario...');

    const paymentRecord = {
        paymentId: 'simulated_manual_' + Date.now(),
        status: 'approved',
        planId: 'black-user-plan',
        userId: 'owBEdOAnd6UBw4gui4gFvIRJOpj2', // ID real del usuario
        email: 'theblexiz3010@gmail.com',
        avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocLnBp-sBroyltvpWR9K6e0ehEuwrSOiO0kw-TV0ICwyt7iuy74=s96-c',
        externalReference: 'black-user-plan_owBEdOAnd6UBw4gui4gFvIRJOpj2_1763907507150'
    };

    try {
        await processApprovedPayment(paymentRecord);
        console.log('✅ Simulación completada con éxito.');
    } catch (error) {
        console.error('❌ Error en la simulación:', error);
    }
}

run();
