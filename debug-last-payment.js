import 'dotenv/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db, updateUserTipo, getUserFromFirestore } from './lib/firebase.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!MERCADOPAGO_ACCESS_TOKEN) {
    console.error('❌ MERCADOPAGO_ACCESS_TOKEN not found in .env');
    process.exit(1);
}

const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

async function debugLastPayment() {
    console.log('🔍 Searching for latest approved payment...');

    try {
        // Search for the latest approved payment
        const searchResult = await payment.search({
            options: {
                sort: 'date_created',
                criteria: 'desc',
                limit: 1,
                status: 'approved'
            }
        });

        if (!searchResult.results || searchResult.results.length === 0) {
            console.log('❌ No approved payments found.');
            return;
        }

        const lastPayment = searchResult.results[0];
        console.log(`\n💰 Payment Found: ${lastPayment.id}`);
        console.log(`   Status: ${lastPayment.status}`);
        console.log(`   Date: ${lastPayment.date_created}`);
        console.log(`   External Reference: ${lastPayment.external_reference}`);

        // Extract info
        const externalReference = lastPayment.external_reference || '';
        const parts = externalReference.split('_');
        const planId = parts[0] || 'unknown';
        const userId = parts[1] || 'unknown';

        console.log(`\n🧩 Extracted Data:`);
        console.log(`   Plan ID: ${planId}`);
        console.log(`   User ID: ${userId}`);

        if (userId === 'anon' || userId === 'unknown') {
            console.error('❌ CRITICAL: User ID is missing in the payment reference!');
            console.error('   This means the frontend did not send the userId correctly to /create-preference.');
            return;
        }

        // Check if user exists in Firebase
        console.log(`\n👤 Checking User in Firestore (${userId})...`);
        const user = await getUserFromFirestore(userId);

        if (!user) {
            console.error(`❌ User document '${userId}' NOT found in Firestore.`);
            console.error('   The ID sent in the payment does not match any user in the database.');
            return;
        }

        console.log(`✅ User found: ${user.email} (Type: ${user.tipoUsuario})`);

        // Simulate Update
        console.log(`\n🔄 Attempting Manual Update...`);
        const targetType = planId.includes('shiny') ? 'shiny' : 'black';
        const permissions = targetType === 'shiny'
            ? ['dark_mode', 'basic_features', 'shiny_game', 'premium_features']
            : ['dark_mode', 'basic_features'];

        await updateUserTipo(userId, targetType, permissions);
        console.log(`✅ Manual update executed successfully.`);

        const updatedUser = await getUserFromFirestore(userId);
        console.log(`   New User Type: ${updatedUser.tipoUsuario}`);

    } catch (error) {
        console.error('❌ Error debugging payment:', error);
    }
}

debugLastPayment();
