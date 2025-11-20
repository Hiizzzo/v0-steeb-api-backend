// Script para probar API key de DeepSeek
const https = require('https');

function testDeepSeekAPI(apiKey) {
  if (!apiKey) {
    console.log('❌ ERROR: No API key provided');
    console.log('Usage: node test-api-key.js YOUR_DEEPSEEK_API_KEY');
    return;
  }

  console.log('🔍 Testing DeepSeek API key...');
  console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');

  const data = JSON.stringify({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant. Respond with just 'OK' to test the connection."
      },
      {
        role: "user",
        content: "Hello, test message"
      }
    ],
    temperature: 0.7,
    max_tokens: 10,
    stream: false
  });

  const options = {
    hostname: 'api.deepseek.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(data)
    }
  };

  console.log('📡 Sending request to:', `https://${options.hostname}${options.path}`);

  const req = https.request(options, (res) => {
    console.log('📊 Response Status:', res.statusCode);
    console.log('📊 Response Headers:', res.headers);

    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const parsed = JSON.parse(responseData);
          console.log('✅ SUCCESS: API key is valid!');
          console.log('💬 Response:', parsed.choices[0]?.message?.content || 'No content');
        } catch (e) {
          console.log('⚠️  WARNING: Invalid JSON response');
          console.log('📄 Raw Response:', responseData);
        }
      } else {
        console.log('❌ ERROR: API request failed');
        console.log('📄 Response Body:', responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ NETWORK ERROR:', error.message);
  });

  req.write(data);
  req.end();
}

// Get API key from command line argument
const apiKey = process.argv[2];
testDeepSeekAPI(apiKey);