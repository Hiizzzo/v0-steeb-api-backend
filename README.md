# STEEB Backend API

Este proyecto es el backend seguro para la app móvil STEEB, desplegado en Vercel.

## 🚀 Instrucciones de Despliegue

### 🏎️ Deploy rápido para conectar con el frontend
1. **Sube el backend a GitHub** (o actualiza el repo existente).
2. **Impórtalo en Vercel** y, en la pantalla inicial, carga estas variables:
   - `DEEPSEEK_API_KEY` (obligatoria)
   - `APP_BASE_URL` / `BASE_URL` con el dominio que te dará Vercel (ej: `https://tu-backend.vercel.app`)
   - `MP_NOTIFICATION_URL` apuntando a `https://tu-backend.vercel.app/api/payments/webhook`
3. **Haz deploy** y copia la URL resultante (`https://tu-backend.vercel.app`).
4. En tu frontend (React/Expo), configura el endpoint de la API en `.env` o en una constante:
   ```bash
   VITE_API_URL=https://tu-backend.vercel.app
   ```
5. Prueba el flujo real llamando a `https://tu-backend.vercel.app/api/steeb` desde el frontend. Si responde 200, ya están conectados.

### 1. Subir a GitHub
Crea un repositorio en GitHub y sube este código.

### 2. Conectar con Vercel
1. Ve a [vercel.com](https://vercel.com) e inicia sesión.
2. Haz clic en **"Add New..."** -> **"Project"**.
3. Importa tu repositorio de GitHub.

### 3. Configurar Variables de Entorno (IMPORTANTE)
En la pantalla de configuración de Vercel, antes de darle a "Deploy", busca la sección **"Environment Variables"**.
Agrega la siguiente variable:

1. Consigue tu API Key aquí: [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
2. Configúrala en Vercel:
    - **Key:** `DEEPSEEK_API_KEY`
    - **Value:** `sk-tu-api-key-de-deepseek-aqui`

*(Si ya desplegaste, ve a Settings -> Environment Variables y agrégala, luego haz un Redeploy).*

### 4. Probar la API
Una vez desplegado, tu API estará disponible en:
`https://nombre-de-tu-proyecto.vercel.app/api/steeb`

Puedes probarla usando el frontend incluido en este proyecto (visitando la URL raíz) o usando Postman/cURL.

---

## 📱 Integración con App Móvil

Copia el archivo `lib/steeb-client.ts` a tu proyecto de React Native / Expo.
Asegúrate de actualizar la constante `API_URL` con tu dominio real de Vercel.

---

## 🛡️ Seguridad y Mejoras

### Rate Limiting (Opcional)
Para evitar abusos, Vercel tiene límites básicos. Para un control real, se recomienda usar **Vercel KV (Redis)** o **Upstash**.
Implementación básica sugerida:
1. Instalar `@vercel/kv`.
2. Usar la IP del usuario como key.
3. Bloquear si supera X peticiones por minuto.

### Logs
Los logs de Vercel (Runtime Logs) mostrarán los `console.log` y errores automáticamente. Ve a la pestaña **Logs** en tu dashboard de Vercel.

### Modelo
Actualmente usa `deepseek-chat` (V3) que es la opción más económica y balanceada.
