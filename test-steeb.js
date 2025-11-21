import fetch from 'node-fetch';

// URL de prueba local (ajustar según necesites)
const API_URL = 'http://localhost:3001/api/steeb';

const testSteebEndpoint = async () => {
  console.log('🚀 Probando endpoint /api/steeb...\n');

  try {
    const testMessages = [
      {
        userId: 'test-user-1',
        message: 'Hola STEEB! Motívame para romperla hoy!',
        description: 'Mensaje motivacional'
      },
      {
        userId: 'test-user-2',
        message: 'Tengo dudas sobre si podré alcanzar mis metas',
        description: 'Mensaje de duda'
      },
      {
        userId: 'test-user-3',
        message: 'Logré terminar mi proyecto!',
        description: 'Mensaje de celebración'
      }
    ];

    for (const test of testMessages) {
      console.log(`📝 Test: ${test.description}`);
      console.log(`👤 User: ${test.userId}`);
      console.log(`💬 Message: "${test.message}"`);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: test.message,
          userId: test.userId
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ Status: ${response.status}`);
        console.log(`🤖 Response: "${data.response}"`);
        console.log(`💾 Cached: ${data.cached}`);
        console.log(`🕐 Timestamp: ${data.timestamp}`);
        if (data.usage) {
          console.log(`📊 Tokens: ${data.usage.totalTokens} total`);
        }
      } else {
        console.log(`❌ Error: ${response.status}`);
        console.log(`🚫 Message: ${data.message}`);
      }

      console.log('─'.repeat(60));
    }

  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    console.log('\n💡 Asegúrate de que:');
    console.log('1. El servidor esté corriendo en http://localhost:3001');
    console.log('2. La variable DEEPSEEK_API_KEY esté configurada');
    console.log('3. Las dependencias estén instaladas (npm install)');
  }
};

// Ejecutar prueba
testSteebEndpoint();