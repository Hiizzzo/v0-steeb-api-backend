# Backend STEEB - Integración con Mercado Pago

Este backend proporciona los endpoints necesarios para procesar pagos con Mercado Pago en la aplicación STEEB.

## Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```env
# Mercado Pago Configuration
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_aqui
VITE_MERCADOPAGO_PUBLIC_KEY=tu_public_key_aqui

# Server Configuration
PORT=3001
APP_BASE_URL=http://localhost:3001
BASE_URL=http://localhost:3001

# Mercado Pago Webhook (opcional)
MP_WEBHOOK_SECRET=tu_secreto_webhook
MP_NOTIFICATION_URL=http://localhost:3001/api/payments/webhook
```

### 3. Iniciar el Servidor

```bash
# Para producción
npm run server

# Para desarrollo (con auto-reload)
npm run server:dev
```

El servidor iniciará en `http://localhost:3001`

## Endpoints Disponibles

### Mercado Pago

#### `POST /api/payments/create-preference`
Crea una preferencia de pago en Mercado Pago.

**Body:**
```json
{
  "planId": "black-user-plan",
  "quantity": 1,
  "userId": "user123",
  "email": "usuario@ejemplo.com",
  "name": "Nombre Usuario"
}
```

**Respuesta:**
```json
{
  "preferenceId": "123456789",
  "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789",
  "sandboxInitPoint": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789",
  "externalReference": "black-user-plan_user123_1234567890",
  "plan": {
    "id": "black-user-plan",
    "title": "Usuario Black",
    "price": 1,
    "tipoUsuario": "black"
  }
}
```

#### `POST /api/payments/verify`
Verifica el estado de un pago.

**Body:**
```json
{
  "paymentId": "123456789",
  "externalReference": "black-user-plan_user123_1234567890",
  "preferenceId": "123456789"
}
```

#### `GET /api/payments/status`
Consulta el estado de compra de un plan por usuario.

**Query Parameters:**
- `planId` (requerido): ID del plan
- `userId` (opcional): ID del usuario
- `email` (opcional): Email del usuario

**Respuesta:**
```json
{
  "hasPurchased": true,
  "status": "approved",
  "planId": "black-user-plan",
  "userId": "user123",
  "paymentId": "123456789",
  "amount": 1,
  "currency": "ARS"
}
```

#### `POST /api/payments/webhook`
Recibe notificaciones de Mercado Pago sobre cambios en el estado de pagos.

### Upload de Imágenes

#### `POST /api/upload-image`
Sube una imagen al servidor.

**Body:** `multipart/form-data` con campo `image`

**Respuesta:**
```json
{
  "success": true,
  "filename": "image-1234567890.jpg",
  "path": "/lovable-uploads/image-1234567890.jpg",
  "original_url": "http://localhost:3001/lovable-uploads/image-1234567890.jpg"
}
```

#### `GET /api/images`
Lista todas las imágenes subidas.

**Respuesta:**
```json
{
  "images": [
    {
      "filename": "image-1234567890.jpg",
      "path": "/lovable-uploads/image-1234567890.jpg",
      "original_url": "http://localhost:3001/lovable-uploads/image-1234567890.jpg",
      "size": 1024
    }
  ]
}
```

## Planes de Pago

Los planes se configuran en `config/paymentPlans.json`. Los planes disponibles son:

- **Usuario Black** ($3000 ARS)
  - Tema oscuro permanente
  - Acceso a funciones Black exclusivas

- **Usuario Shiny** ($5 ARS)
  - Todos los beneficios de Usuario Black
  - Acceso exclusivo al juego Shiny diario
  - Contenido exclusivo y funciones premium
  - Prioridad en soporte y nuevas features

**Tipos de Usuario**:
- **White**: Usuario gratuito (default)
- **Black**: Usuario que compró el plan Black ($3000 ARS)
- **Shiny**: Usuario que compró el plan Shiny ($5 ARS)

## Almacenamiento

Las compras se guardan en `data/purchases.json`. El sistema mantiene un registro de:
- ID del pago
- Estado del pago
- Referencia externa
- Usuario asociado
- Monto y moneda
- Fechas de procesamiento

## Configuración de Webhooks

Para recibir notificaciones en tiempo real de Mercado Pago:

1. Configura la URL del webhook en tu dashboard de Mercado Pago: `https://tu-dominio.com/api/payments/webhook`
2. Establece un secreto en `MP_WEBHOOK_SECRET` para mayor seguridad
3. Actualiza `MP_NOTIFICATION_URL` con la URL pública de tu servidor

## Seguridad

- El webhook valida un token secreto opcional
- Los archivos se limitan a 5MB y solo permiten imágenes
- CORS está configurado para permitir solicitudes desde tu frontend

## Testing

Para probar en modo sandbox:

1. Usa credenciales de sandbox de Mercado Pago
2. Cambia las URLs a `http://localhost:3001` para desarrollo
3. Verifica los pagos con datos de prueba de Mercado Pago

## Errores Comunes

- **401**: Token de Mercado Pago inválido
- **404**: Plan no encontrado o pago no existe
- **400**: Faltan parámetros requeridos
- **500**: Error interno del servidor

## Soporte

Para issues relacionados con Mercado Pago, consulta la [documentación oficial](https://www.mercadopago.com.ar/developers/es/docs).
