# STEEB Backend Deployment Guide

## 🚀 Quick Start for Production Deployment

### 1. Pre-Deployment Checklist

Before deploying to Vercel, run the status check script:

```bash
# On Windows
run-status-check.bat --verbose

# On any platform
node check-backend-status.js --base-url http://localhost:3001 --verbose
```

### 2. Current Status Analysis

Based on the codebase analysis, here's what's configured:

#### ✅ Working Components:
- **Mercado Pago Token**: `APP_USR-1230500824177206-112014-b9ed9d48828945cae62ad21680fb7b12-249173215`
- **Payment Plans**: `config/paymentPlans.json` contains "Dark mode" plan (1 ARS)
- **API Endpoints**: All Mercado Pago endpoints are implemented
- **Express Server**: Ready for production deployment

#### ⚠️ Configuration Issues Found:
- **Development URLs**: Current config uses `http://localhost:3001`
- **Missing Health Endpoint**: Needs server restart to activate new endpoint

### 3. Required Vercel Environment Variables

```bash
# Mercado Pago Configuration (CRITICAL)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1230500824177206-112014-b9ed9d48828945cae62ad21680fb7b12-249173215
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-8bdceff7-5a52-41b1-b27a-8e69f8fa7023

# Production URLs (REPLACE with your actual URLs)
APP_BASE_URL=https://your-app.vercel.app
BASE_URL=https://your-backend.vercel.app
MP_NOTIFICATION_URL=https://your-backend.vercel.app/api/payments/webhook
PORT=3001

# Optional but recommended
MP_WEBHOOK_SECRET=your-webhook-secret-here
```

### 4. Production Backend URL

After deploying to Vercel, your backend URL will be:
```
https://your-backend-name.vercel.app
```

### 5. Frontend Configuration

Update your frontend `.env` file:
```bash
VITE_API_URL=https://your-backend-name.vercel.app
```

### 6. Local Testing Before Deployment

#### Step 1: Restart your local server
```bash
# Stop current server (Ctrl+C if running)
# Then restart
npm run server
# or for development
npm run server:dev
```

#### Step 2: Run status check
```bash
node check-backend-status.js --verbose
```

Expected results:
- ✅ All 4/4 checks should pass
- ✅ Health endpoint should be accessible
- ✅ Mercado Pago endpoints should work
- ✅ Payment plans should be found

### 7. Vercel Deployment Steps

1. **Push your code to GitHub** (if not already done)
2. **Connect repository to Vercel**
3. **Configure environment variables in Vercel dashboard**
4. **Deploy**

#### Vercel Configuration Settings:
- **Framework**: Next.js (or Node.js for Express)
- **Build Command**: `npm run build`
- **Install Command**: `npm install --legacy-peer-deps`
- **Output Directory**: `.next` (for Next.js) or root (for Express)

### 8. Post-Deployment Verification

After deployment, run the status check against your production URL:

```bash
node check-backend-status.js --base-url https://your-backend.vercel.app --verbose
```

### 9. Webhook Configuration

Configure Mercado Pago webhook in your account:
- **Webhook URL**: `https://your-backend.vercel.app/api/payments/webhook`
- **Events**: `payment`, `merchant_order`
- **Secret**: Use the same value as `MP_WEBHOOK_SECRET`

### 10. Troubleshooting Guide

#### Common Issues:

1. **Health Check Fails (404 Error)**
   - Restart the server: `npm run server`
   - Ensure the updated server.js is deployed

2. **Mercado Pago Token Issues**
   - Verify token format starts with `APP_USR-`
   - Check token is valid for production environment

3. **Payment Plans Not Found**
   - Ensure `config/paymentPlans.json` is included in deployment
   - Check file permissions

4. **Webhook Not Receiving Events**
   - Verify webhook URL is accessible
   - Check webhook secret matches

5. **CORS Issues**
   - Ensure frontend URL is properly configured in `APP_BASE_URL`
   - Check CORS configuration if needed

### 11. Security Considerations

- ✅ Environment variables are masked in health check
- ✅ Webhook secret should be set for production
- ✅ Use HTTPS URLs in production
- ✅ Monitor Mercado Pago API rate limits

### 12. Testing Checklist

#### Before Production:
- [ ] All environment variables configured
- [ ] Health endpoint returns 200 OK
- [ ] Payment verification works
- [ ] Payment plan creation works
- [ ] Webhook endpoint responds
- [ ] Frontend connects successfully

#### After Production:
- [ ] Test actual payment flow
- [ ] Verify webhook receives events
- [ ] Check payment persistence
- [ ] Test error handling
- [ ] Monitor server logs

### 13. Monitoring

Set up monitoring for:
- `/api/health` endpoint (uptime)
- Mercado Pago API responses
- Webhook processing
- Error rates

### 14. Complete Production URLs Example

```bash
# Backend (Replace with your actual Vercel URL)
VITE_API_URL=https://steeb-backend.vercel.app

# Vercel Environment Variables
APP_BASE_URL=https://steeb-app.vercel.app
BASE_URL=https://steeb-backend.vercel.app
MP_NOTIFICATION_URL=https://steeb-backend.vercel.app/api/payments/webhook
```

### 15. Success Criteria

Your deployment is successful when:
- ✅ Health check returns all green checks
- ✅ All Mercado Pago endpoints are accessible
- ✅ Payment creation and verification work
- ✅ Webhook receives Mercado Pago events
- ✅ Frontend can connect to backend API
- ✅ Payment data persists correctly

---

## 🎯 Quick Commands Summary

```bash
# Test local setup
npm run server
node check-backend-status.js --verbose

# Test production setup
node check-backend-status.js --base-url https://your-backend.vercel.app --verbose

# Deploy to Vercel (after configuring env vars)
vercel --prod
```

## 📞 Support

If you encounter issues:
1. Run status check with `--verbose` flag
2. Check server logs for errors
3. Verify all environment variables are set
4. Ensure all required files are deployed
5. Test with a fresh deployment if needed

---

**🎉 Once you complete these steps, your STEEB backend will be ready for production with full Mercado Pago integration!**