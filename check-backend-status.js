#!/usr/bin/env node

/**
 * STEEB Backend Status Check Script
 *
 * This comprehensive verification script tests all Mercado Pago integration
 * endpoints and environment variables to help verify backend configuration.
 *
 * Usage: node check-backend-status.js [options]
 *
 * Options:
 *   --base-url <url>    Base URL to test (default: http://localhost:3001)
 *   --payment-id <id>   Payment ID to test with verify endpoint
 *   --verbose           Show detailed output
 *   --help              Show this help
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration from requirements
const EXPECTED_MERCADOPAGO_TOKEN = 'APP_USR-1230500824177206-112014-b9ed9d48828945cae62ad21680fb7b12-249173215';

// Parse command line arguments
const args = process.argv.slice(2);
let baseUrl = 'http://localhost:3001';
let testPaymentId = '1234567890'; // Test payment ID for verify endpoint
let verbose = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--base-url':
      baseUrl = args[++i];
      break;
    case '--payment-id':
      testPaymentId = args[++i];
      break;
    case '--verbose':
      verbose = true;
      break;
    case '--help':
      console.log(`STEEB Backend Status Check Script

This script verifies your backend configuration for Mercado Pago integration.

Usage: node ${path.basename(__filename)} [options]

Options:
  --base-url <url>    Base URL to test (default: http://localhost:3001)
  --payment-id <id>   Payment ID to test with verify endpoint
  --verbose           Show detailed output
  --help              Show this help

Examples:
  node ${path.basename(__filename)}
  node ${path.basename(__filename)} --base-url https://your-app.vercel.app
  node ${path.basename(__filename)} --base-url https://your-backend.vercel.app --verbose
  node ${path.basename(__filename)} --payment-id 987654321 --verbose`);
      process.exit(0);
  }
}

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  let color = colors.reset;

  switch (level) {
    case 'SUCCESS':
      color = colors.green;
      break;
    case 'ERROR':
      color = colors.red;
      break;
    case 'WARNING':
      color = colors.yellow;
      break;
    case 'INFO':
      color = colors.blue;
      break;
    case 'HEADER':
      color = colors.cyan + colors.bold;
      break;
  }

  console.log(`${color}[${level}]${colors.reset} ${timestamp} - ${message}`);
}

function logVerbose(message) {
  if (verbose) {
    console.log(`${colors.cyan}[VERBOSE]${colors.reset} ${message}`);
  }
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;

    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'STEEB-Status-Check/1.0',
        ...options.headers
      }
    };

    if (options.body) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = client.request(url, requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = res.headers['content-type']?.includes('application/json')
            ? JSON.parse(data)
            : data;

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testEndpoint(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  logVerbose(`Testing endpoint: ${url}`);

  try {
    const response = await makeRequest(url, options);
    logVerbose(`Response status: ${response.statusCode}`);

    if (verbose && response.data) {
      logVerbose(`Response data:`, JSON.stringify(response.data, null, 2));
    }

    return {
      success: response.statusCode >= 200 && response.statusCode < 300,
      statusCode: response.statusCode,
      data: response.data,
      error: null
    };
  } catch (error) {
    logVerbose(`Request failed: ${error.message}`);
    return {
      success: false,
      statusCode: null,
      data: null,
      error: error.message
    };
  }
}

async function checkEnvironmentVariables() {
  log('HEADER', '🔍 Checking Environment Variables');

  const requiredEnvVars = [
    'MERCADOPAGO_ACCESS_TOKEN',
    'APP_BASE_URL',
    'MP_NOTIFICATION_URL'
  ];

  const results = {};

  for (const envVar of requiredEnvVars) {
    logVerbose(`Checking environment variable: ${envVar}`);

    try {
      const response = await testEndpoint('/api/health');
      if (response.success && response.data.environment) {
        const value = response.data.environment[envVar];
        if (value) {
          results[envVar] = {
            configured: true,
            value: envVar === 'MERCADOPAGO_ACCESS_TOKEN' ? value.substring(0, 20) + '...' : value
          };
          log('SUCCESS', `✅ ${envVar} is configured`);
        } else {
          results[envVar] = {
            configured: false,
            value: null
          };
          log('ERROR', `❌ ${envVar} is NOT configured`);
        }
      } else {
        results[envVar] = {
          configured: 'unknown',
          value: null,
          note: 'Could not determine - health endpoint not responding'
        };
        log('WARNING', `⚠️ Could not verify ${envVar} - health endpoint not accessible`);
      }
    } catch (error) {
      results[envVar] = {
        configured: 'unknown',
        value: null,
        note: `Health endpoint error: ${error.message}`
      };
      log('ERROR', `❌ Could not check ${envVar}: ${error.message}`);
    }
  }

  // Special check for Mercado Pago token
  if (results.MERCADOPAGO_ACCESS_TOKEN.configured === true) {
    log('INFO', `Expected token starts with: ${EXPECTED_MERCADOPAGO_TOKEN.substring(0, 20)}...`);
    log('WARNING', '⚠️ Cannot verify exact token match for security reasons');
  }

  return results;
}

async function testMercadoPagoEndpoints() {
  log('HEADER', '💳 Testing Mercado Pago Endpoints');

  const endpoints = [
    {
      path: '/api/health',
      method: 'GET',
      description: 'Health check endpoint'
    },
    {
      path: '/api/payments/verify',
      method: 'POST',
      body: JSON.stringify({ paymentId: testPaymentId }),
      description: 'Payment verification endpoint'
    }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    logVerbose(`Testing ${endpoint.description}`);

    const result = await testEndpoint(endpoint.path, {
      method: endpoint.method,
      body: endpoint.body
    });

    if (result.success) {
      log('SUCCESS', `✅ ${endpoint.description} - ${result.statusCode}`);
    } else {
      log('ERROR', `❌ ${endpoint.description} - ${result.statusCode || 'Connection error'}`);
      if (result.error) {
        log('ERROR', `   Error: ${result.error}`);
      }
    }

    results.push({
      path: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      success: result.success,
      statusCode: result.statusCode,
      error: result.error
    });
  }

  return results;
}

async function checkConfigurationFiles() {
  log('HEADER', '📁 Checking Configuration Files');

  const results = {};

  // Check if payment plans are accessible via an endpoint
  logVerbose('Checking payment plans configuration');

  try {
    const response = await testEndpoint('/api/payments/create-preference', {
      method: 'POST',
      body: JSON.stringify({
        planId: 'dark-mode-premium',
        quantity: 1,
        userId: 'test-user',
        email: 'test@example.com'
      })
    });

    if (response.success) {
      log('SUCCESS', '✅ paymentPlans.json is properly configured');
      results.paymentPlans = {
        configured: true,
        note: 'Plans are accessible via create-preference endpoint'
      };

      if (response.data.plan) {
        log('INFO', `📋 Available plan: ${response.data.plan.title} - ${response.data.plan.price} ${response.data.plan.currency}`);
      }
    } else {
      log('ERROR', '❌ paymentPlans.json may not be configured or accessible');
      results.paymentPlans = {
        configured: false,
        note: 'Create preference endpoint failed'
      };
    }
  } catch (error) {
    log('ERROR', `❌ Could not verify payment plans: ${error.message}`);
    results.paymentPlans = {
      configured: 'unknown',
      note: `Error: ${error.message}`
    };
  }

  return results;
}

async function generateProductionConfig() {
  log('HEADER', '🚀 Production Configuration Guide');

  log('INFO', 'Based on your testing, here\'s what you need to configure for Vercel deployment:');

  console.log('\n' + colors.cyan + colors.bold + 'VERCEL ENVIRONMENT VARIABLES:' + colors.reset);
  console.log('```');
  console.log('# Mercado Pago Configuration');
  console.log('MERCADOPAGO_ACCESS_TOKEN=' + EXPECTED_MERCADOPAGO_TOKEN);
  console.log('VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-8bdceff7-5a52-41b1-b27a-8e69f8fa7023');
  console.log('');
  console.log('# Production URLs (REPLACE with your actual URLs)');
  console.log('APP_BASE_URL=https://your-app.vercel.app');
  console.log('BASE_URL=https://your-backend.vercel.app');
  console.log('MP_NOTIFICATION_URL=https://your-backend.vercel.app/api/payments/webhook');
  console.log('PORT=3001');
  console.log('```');

  console.log('\n' + colors.cyan + colors.bold + 'FRONTEND CONFIGURATION:' + colors.reset);
  console.log('Update your frontend .env file:');
  console.log('```');
  console.log(`VITE_API_URL=${baseUrl}`);
  console.log('```\n');

  log('WARNING', '⚠️ IMPORTANT: Replace the placeholder URLs with your actual Vercel URLs');
  log('WARNING', '⚠️ Make sure paymentPlans.json is included in your deployment');
}

function printSummary(results) {
  log('HEADER', '📊 Status Check Summary');

  const totalChecks = Object.values(results).flat().length;
  const passedChecks = Object.values(results).flat().filter(r =>
    typeof r === 'object' ? r.success || r.configured === true : r
  ).length;

  console.log(`\n${colors.bold}Overall Status: ${passedChecks}/${totalChecks} checks passed${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    log('SUCCESS', '🎉 All checks passed! Your backend is ready for production.');
  } else {
    log('WARNING', '⚠️ Some checks failed. Please review the issues above.');
  }

  console.log('\n' + colors.cyan + colors.bold + 'NEXT STEPS:' + colors.reset);
  console.log('1. Configure the required environment variables in Vercel');
  console.log('2. Update your frontend VITE_API_URL to point to your production backend');
  console.log('3. Test with your actual Vercel deployment URL');
  console.log('4. Verify Mercado Pago webhook configuration');
}

async function main() {
  console.log(colors.blue + colors.bold);
  console.log('🚀 STEEB Backend Status Check');
  console.log('=================================');
  console.log(colors.reset);

  console.log(`Base URL: ${colors.cyan}${baseUrl}${colors.reset}`);
  console.log(`Test Payment ID: ${colors.cyan}${testPaymentId}${colors.reset}`);
  console.log(`Verbose: ${colors.cyan}${verbose}${colors.reset}\n`);

  const results = {
    environment: await checkEnvironmentVariables(),
    endpoints: await testMercadoPagoEndpoints(),
    configuration: await checkConfigurationFiles()
  };

  await generateProductionConfig();
  printSummary(results);

  console.log('\n' + colors.green + colors.bold + 'Status check completed! ✨' + colors.reset);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', `Unhandled rejection: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log('ERROR', `Uncaught exception: ${error.message}`);
  if (verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});

// Run the status check
main().catch(error => {
  log('ERROR', `Status check failed: ${error.message}`);
  if (verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});