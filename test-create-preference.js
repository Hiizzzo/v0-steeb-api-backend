import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testCreatePreference() {
    console.log('🚀 Iniciando prueba de simulación de Frontend...');
    console.log(`📡 Conectando a: ${BASE_URL}`);

    // Datos simulados (como si fuera el Frontend real)
    const payload = {
        planId: 'black-user-plan',
        userId: 'owBEdOAnd6UBw4gui4gFvIRJOpj2', // ID real que sacamos de la foto
        email: 'test@example.com',
        name: 'Usuario de Prueba',
        quantity: 1
    };

    console.log('\n📦 Enviando payload:', payload);

    try {
        const response = await fetch(`${BASE_URL}/api/payments/create-preference`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log(`\n📥 Respuesta del Servidor: Status ${response.status}`);

        if (response.ok) {
            console.log('✅ ¡ÉXITO! El backend aceptó la petición.');
            console.log('🔑 Preference ID:', data.preferenceId);
            console.log('🔗 Init Point:', data.initPoint);
            console.log('🏷️ External Reference Generada:', data.externalReference);

            // Verificar que el externalReference tenga el userId
            if (data.externalReference && data.externalReference.includes(payload.userId)) {
                console.log('✨ VERIFICADO: El userId está correctamente incluido en la referencia externa.');
            } else {
                console.error('⚠️ ALERTA: El userId NO aparece en la referencia externa.');
            }
        } else {
            console.error('❌ ERROR: El backend rechazó la petición.');
            console.error('Error details:', data);
        }

    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        console.log('💡 Asegurate de que el servidor esté corriendo en el puerto 3001 (npm run server)');
    }
}

testCreatePreference();
