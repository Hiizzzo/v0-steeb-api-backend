# STEEB Backend Status Check

This directory contains comprehensive verification scripts to test all Mercado Pago integration endpoints and environment variables.

## 🚀 Quick Start

### Windows (Recommended)
```bash
# Run the status check with default settings (localhost:3001)
run-status-check.bat

# Run with verbose output
run-status-check.bat --verbose

# Test a production deployment
run-status-check.bat --base-url https://your-backend.vercel.app --verbose
```

### Node.js (Cross-platform)
```bash
# Default check
node check-backend-status.js

# With custom base URL
node check-backend-status.js --base-url https://your-backend.vercel.app

# With verbose output
node check-backend-status.js --verbose

# Help
node check-backend-status.js --help
```

## 📋 What the Script Checks

### 1. Environment Variables
- ✅ `MERCADOPAGO_ACCESS_TOKEN` - Mercado Pago API access token
- ✅ `VITE_MERCADOPAGO_PUBLIC_KEY` - Frontend public key
- ✅ `APP_BASE_URL` - Application base URL
- ✅ `MP_NOTIFICATION_URL` - Webhook notification URL
- ✅ `MP_WEBHOOK_SECRET` - Webhook security secret (optional)

### 2. API Endpoints
- ✅ `/api/health` - Server health check and environment status
- ✅ `/api/payments/verify` - Payment verification endpoint
- ✅ `/api/payments/create-preference` - Payment preference creation
- ✅ `/api/payments/webhook` - Mercado Pago webhook handler

### 3. Configuration Files
- ✅ `config/paymentPlans.json` - Payment plans configuration
- ✅ Mercado Pago token validation
- ✅ Server connectivity

## 🔧 Production Deployment Checklist

### Required Vercel Environment Variables

```bash
# Mercado Pago Configuration
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1230500824177206-112014-b9ed9d48828945cae62ad21680fb7b12-249173215
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-8bdceff7-5a52-41b1-b27a-8e69f8fa7023

# Production URLs (REPLACE with your actual URLs)
APP_BASE_URL=https://your-app.vercel.app
BASE_URL=https://your-backend.vercel.app
MP_NOTIFICATION_URL=https://your-backend.vercel.app/api/payments/webhook
PORT=3001
```

### Frontend Configuration

Update your frontend `.env` file:
```bash
VITE_API_URL=https://your-backend.vercel.app
```

### Required Files for Deployment

- ✅ `config/paymentPlans.json` - Must be included in deployment
- ✅ `.env` - Local development environment variables
- ✅ `package.json` - Dependencies and scripts
- ✅ `vercel.json` - Vercel deployment configuration

## 📊 Understanding the Output

### Status Indicators
- ✅ **SUCCESS** - Check passed
- ❌ **ERROR** - Check failed
- ⚠️ **WARNING** - Check passed but needs attention
- 🔍 **INFO** - Informational message

### Key Results

1. **Environment Variables**: Shows which required variables are configured
2. **Endpoint Testing**: Tests API connectivity and functionality
3. **Configuration Status**: Verifies payment plans and Mercado Pago setup
4. **Production Guide**: Provides specific configuration needed for deployment

## 🛠️ Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure the server is running: `npm run server` or `npm run server:dev`
   - Check if port 3001 is available

2. **Missing Environment Variables**
   - Verify `.env` file exists with required variables
   - For production, check Vercel environment variables

3. **Payment Plans Not Found**
   - Ensure `config/paymentPlans.json` exists and is valid JSON
   - Check file permissions

4. **Mercado Pago Token Issues**
   - Verify token format: `APP_USR-XXXX...`
   - Check token is valid for your Mercado Pago account

### Debug Mode

Use the `--verbose` flag for detailed output:
```bash
node check-backend-status.js --verbose
```

This will show:
- Detailed request/response data
- Step-by-step execution
- Error stack traces
- Raw API responses

## 📞 Support

If you encounter issues:

1. Run the status check with `--verbose` flag
2. Check the server logs: `npm run server:dev`
3. Verify environment variables in `.env` file
4. Ensure all required files are present

## 🔄 Continuous Monitoring

For production deployments, consider:

1. Setting up monitoring for the `/api/health` endpoint
2. Creating alerts for failed webhook deliveries
3. Regular testing of payment verification endpoints
4. Monitoring Mercado Pago API rate limits

## 📝 Example Output

```
🚀 STEEB Backend Status Check
=================================

Base URL: http://localhost:3001
Test Payment ID: 1234567890
Verbose: false

[HEADER] 🔍 Checking Environment Variables
[SUCCESS] ✅ MERCADOPAGO_ACCESS_TOKEN is configured
[SUCCESS] ✅ APP_BASE_URL is configured
[SUCCESS] ✅ MP_NOTIFICATION_URL is configured

[HEADER] 💳 Testing Mercado Pago Endpoints
[SUCCESS] ✅ Health check endpoint - 200
[SUCCESS] ✅ Payment verification endpoint - 200

[HEADER] 📁 Checking Configuration Files
[SUCCESS] ✅ paymentPlans.json is properly configured

[HEADER] 🚀 Production Configuration Guide

VERCEL ENVIRONMENT VARIABLES:
```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1230500824177206-112014-b9ed9d48828945cae62ad21680fb7b12-249173215
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-8bdceff7-5a52-41b1-b27a-8e69f8fa7023
APP_BASE_URL=https://your-app.vercel.app
BASE_URL=https://your-backend.vercel.app
MP_NOTIFICATION_URL=https://your-backend.vercel.app/api/payments/webhook
PORT=3001
```

FRONTEND CONFIGURATION:
```
VITE_API_URL=http://localhost:3001
```

[WARNING] ⚠️ IMPORTANT: Replace the placeholder URLs with your actual Vercel URLs
[WARNING] ⚠️ Make sure paymentPlans.json is included in your deployment

[HEADER] 📊 Status Check Summary

Overall Status: 6/6 checks passed

[SUCCESS] 🎉 All checks passed! Your backend is ready for production.

[INFO] NEXT STEPS:
1. Configure the required environment variables in Vercel
2. Update your frontend VITE_API_URL to point to your production backend
3. Test with your actual Vercel deployment URL
4. Verify Mercado Pago webhook configuration

[SUCCESS] ✨ Status check completed!
```

---

**Note**: This script is designed to help you verify your backend configuration for production deployment. It tests all critical components of the Mercado Pago integration and provides clear guidance on what needs to be configured.