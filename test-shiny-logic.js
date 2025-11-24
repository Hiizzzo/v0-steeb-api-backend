// Test directo de la lógica de asignación de tiradas
import 'dotenv/config';
import { processApprovedPayment } from './api/payments/webhook.js';
import { getUserFromFirestore, db } from './lib/firebase.js';

const TEST_EMAIL = 'theblexiz3010@gmail.com'; // Usuario real para probar

const runTest = async () => {
  console.log('🧪 Iniciando prueba de lógica de Shiny Rolls...');

  // 1. Obtener estado inicial
  console.log(`\n📊 Estado inicial de ${TEST_EMAIL}:`);
  let user = await getUserFromFirestoreByEmail(TEST_EMAIL);
  if (!user) {
    console.error('❌ Usuario no encontrado. Asegúrate de que el email sea correcto.');
    process.exit(1);
  }
  const initialRolls = user.shinyRolls || 0;
  console.log(`   - Shiny Rolls: ${initialRolls}`);
  console.log(`   - ID: ${user.id}`);

  // 2. Simular pago aprobado de 5 tiradas
  const mockPayment = {
    paymentId: `test_pay_${Date.now()}`,
    status: 'approved',
    planId: 'shiny-roll-5', // Plan de 5 tiradas
    userId: user.id, // ID real del usuario
    email: user.email,
    amount: 1,
    currency: 'ARS',
    externalReference: `shiny-roll-5_${user.id}`,
    payerId: 'test_payer_123'
  };

  console.log('\n💳 Simulando pago aprobado:', mockPayment.planId);
  
  try {
    await processApprovedPayment(mockPayment);
    console.log('✅ processApprovedPayment ejecutado sin errores.');
  } catch (error) {
    console.error('❌ Error en processApprovedPayment:', error);
    process.exit(1);
  }

  // 3. Verificar estado final
  console.log(`\n📊 Verificando estado final...`);
  // Pequeña espera para asegurar que Firestore se actualizó (aunque await debería bastar)
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const updatedUser = await getUserFromFirestoreByEmail(TEST_EMAIL);
  const finalRolls = updatedUser.shinyRolls || 0;
  
  console.log(`   - Shiny Rolls iniciales: ${initialRolls}`);
  console.log(`   - Shiny Rolls finales:   ${finalRolls}`);
  
  if (finalRolls === initialRolls + 5) {
    console.log('🎉 ¡ÉXITO! Se acreditaron 5 tiradas correctamente.');
  } else {
    console.log('⚠️ ALERTA: La cantidad de tiradas no coincide con lo esperado.');
    console.log(`   Diferencia: ${finalRolls - initialRolls} (Esperado: +5)`);
  }

  process.exit(0);
};

// Helper para buscar por email ya que getUserFromFirestore usa ID
async function getUserFromFirestoreByEmail(email) {
  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

runTest();