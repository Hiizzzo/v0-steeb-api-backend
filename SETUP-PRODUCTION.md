# 🚀 Guía de Configuración para Producción - STEEB Backend

## 📋 Requisitos Previos

Antes de configurar el backend en producción, necesitas tener:

1. **Proyecto Firebase** configurado
2. **Cuenta de Mercado Pago** habilitada para producción
3. **API Key de DeepSeek** para el motor de IA
4. **Acceso a Vercel** para deployment

---

## 🔥 Paso 1: Configurar Firebase

### 1.1 Crear Proyecto Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto"
3. Nombra tu proyecto: `steeb-app-production`
4. Continúa con la configuración por defecto

### 1.2 Configurar Firestore Database
1. En tu proyecto Firebase, ve a **Firestore Database**
2. Haz clic en "Crear base de datos"
3. Elige "Iniciar en modo de producción"
4. Selecciona una ubicación (ej: `us-central1`)
5. Crea las siguientes colecciones:
   - `users` (para datos de usuarios)
   - `payments` (para registros de pagos)

### 1.3 Obtener Credenciales de Servicio
1. Ve a **Project Settings** > **Service accounts**
2. Haz clic en **"Generate new private key"**
3. Descarga el archivo JSON
4. Abre el archivo y copia estos valores:
   ```json
   {
     "project_id": "steeb-app-production",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...",
     "client_email": "firebase-adminsdk-xxxxx@steeb-app-production.iam.gserviceaccount.com"
   }
   ```

---

## 💰 Paso 2: Configurar Mercado Pago

### 2.1 Configurar Credenciales de Producción
1. Ve a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Inicia sesión con tu cuenta de Mercado Pago
3. Ve a **"Tus integraciones"** > **Credenciales**
4. Copia los siguientes valores:
   - **Access Token**: `APP_USR-XXXXXXXXXXXXX-XXXXXXXXXXXXX-XXXXXXXXXXXXX`
   - **Public Key**: `APP_USR-XXXXXXXXXXXXXXXXXXXXXXXX`

### 2.2 Configurar Webhooks (Recomendado)
1. En la misma sección de credenciales, ve a **"Webhooks"**
2. Agrega la URL de producción: `https://v0-steeb-api-backend.vercel.app/api/payments/webhook`
3. Configura los eventos: `payment`, `merchant_order`
4. Genera y copia el webhook secret

---

## 🤖 Paso 3: Configurar DeepSeek AI

### 3.1 Obtener API Key
1. Ve a [DeepSeek Platform](https://platform.deepseek.com/)
2. Regístrate o inicia sesión
3. Ve a **API Keys**
4. Haz clic en **"Create new key"**
5. Copia la API key generada (empieza con `sk-`)

---

## 🚀 Paso 4: Configurar Variables de Entorno

### 4.1 Configurar en Vercel
1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Ve a **Settings** > **Environment Variables**
3. Agrega las siguientes variables:

#### 🔥 Firebase Variables
```
FIREBASE_PROJECT_ID=steeb-app-production
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@steeb-app-production.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

#### 💰 Mercado Pago Variables
```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1234567890123456-XXXXXXXXXXXXXX-XXXXXXXXXXXXXXXX
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-1234567890123456-XXXXXXXXXXXXXXXXXXXXXXXX
MP_WEBHOOK_SECRET=tu_secreto_webhook_muy_seguro_123456
MP_NOTIFICATION_URL=https://v0-steeb-api-backend.vercel.app/api/payments/webhook
```

#### 🤖 AI Variables
```
DEEPSEEK_API_KEY=sk-deepseek-api-key-aqui
```

#### 🚀 Server Variables
```
PORT=3001
APP_BASE_URL=https://v0-steeb-api-backend.vercel.app
BASE_URL=https://v0-steeb-api-backend.vercel.app
NODE_ENV=production
```

---

## 🔧 Paso 5: Reglas de Seguridad para Firestore

Configura las reglas de seguridad en Firestore para proteger tus datos:

1. Ve a **Firestore Database** > **Reglas**
2. Reemplaza las reglas existentes con:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own documents
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Payment records are write-only for the system
    match /payments/{paymentId} {
      allow read: if request.auth != null;
      allow write: if false; // Only backend can write
    }
  }
}
```

---

## 🧪 Paso 6: Testing en Producción

### 6.1 Verificar Conexiones
1. Despliega el backend a Vercel
2. Prueba los endpoints:
   - `GET /api/health` - Verificar que el servidor está funcionando
   - `GET /api/users/role?userId=test` - Verificar conexión a Firebase

### 6.2 Test de Pagos
1. Usa la API de Mercado Pago en modo prueba primero
2. Verifica que los webhooks funcionen correctamente
3. Confirma que los usuarios se actualicen en Firestore

---

## 🚨 Consideraciones de Seguridad

1. **Nunca exponer credenciales** en el código fuente
2. **Usar HTTPS** siempre (Vercel lo hace automáticamente)
3. **Validar webhooks** con el secreto configurado
4. **Monitorear logs** en Vercel para detectar errores
5. **Limitar la tasa de requests** si es necesario

---

## 📊 Monitoreo y Logs

### Logs en Vercel
- Ve a **Functions** > **_logs** en tu dashboard de Vercel
- Filtra por función (endpoint) para ver errores específicos

### Firebase Monitoring
- Ve a **Performance** en Firebase Console
- Configura alertas para errores frecuentes

---

## 🔄 Mantenimiento

### Actualizaciones Regulares
- Actualiza las dependencias con `npm update`
- Revisa y actualiza las API keys si expiran
- Monitorea los límites de uso de las APIs

### Backups
- Configura backups automáticos en Firestore
- Exporta regularmente los datos de usuarios y pagos

---

## 🆘 Soporte y Troubleshooting

### Problemas Comunes

**Error: Firebase no se inicializa**
```
✅ Solución: Verifica que FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY estén correctos
```

**Error: Mercado Pago 401 Unauthorized**
```
✅ Solución: Verifica que MERCADOPAGO_ACCESS_TOKEN sea correcto y no haya expirado
```

**Error: CORS**
```
✅ Solución: Asegúrate de que FRONTEND_URL esté configurado correctamente en Vercel
```

### Contacto
- Firebase: https://firebase.google.com/support
- Mercado Pago: https://www.mercadopago.com.ar/developers
- Vercel: https://vercel.com/support

---

## ✅ Checklist Final de Producción

- [ ] Proyecto Firebase configurado
- [ ] Firestore Database creado
- [ ] Credenciales de Firebase configuradas
- [ ] Cuenta de Mercado Pago habilitada
- [ ] API Key de DeepSeek obtenida
- [ ] Variables de entorno configuradas en Vercel
- [ ] Reglas de seguridad de Firestore configuradas
- [ ] Webhooks de Mercado Pago configurados
- [ ] Tests de integración realizados
- [ ] Monitoring configurado
- [ ] Backups automáticos configurados

¡Tu backend de STEEB está listo para producción! 🎉