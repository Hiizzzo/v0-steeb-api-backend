# 🎯 API Post-Compra - STEEB Backend

## 🔗 Endpoint

**URL**: `POST /api/payments/post-purchase`

## 📝 Descripción

Este endpoint permite que el frontend envíe los datos del usuario después de completar una compra en Mercado Pago. El backend verifica el pago y actualiza automáticamente el rol del usuario a `black` o `shiny` según el plan comprado.

## 📋 Request Body

```json
{
  "paymentId": "134300149639",              // Required: ID del pago de Mercado Pago
  "userId": "user123",                     // Required: ID del usuario en tu sistema
  "userEmail": "usuario@email.com",        // Required: Email del usuario
  "userAvatar": "https://.../avatar.jpg", // Optional: URL del avatar del usuario
  "userName": "Nombre del Usuario"         // Optional: Nombre del usuario
}
```

## ✅ Response (Exitoso)

```json
{
  "success": true,
  "message": "Usuario actualizado exitosamente",
  "data": {
    "userId": "user123",
    "userEmail": "usuario@email.com",
    "tipoUsuario": "black",
    "permissions": ["dark_mode", "basic_features"],
    "planId": "black-user-plan",
    "paymentId": "134300149639",
    "paymentStatus": "approved",
    "avatar": "https://.../avatar.jpg",
    "displayName": "Nombre del Usuario"
  },
  "meta": {
    "timestamp": "2025-11-22T23:45:30.123Z",
    "paymentProcessed": true,
    "userRoleUpdated": true
  }
}
```

## ❌ Response (Errores)

**Error 400 - Datos incompletos:**
```json
{
  "success": false,
  "error": "Bad request",
  "message": "paymentId, userId y userEmail son requeridos"
}
```

**Error 400 - Pago no aprobado:**
```json
{
  "success": false,
  "error": "Payment not approved",
  "message": "El pago no está aprobado. Status actual: pending",
  "paymentStatus": "pending"
}
```

**Error 404 - Pago no encontrado:**
```json
{
  "success": false,
  "error": "Payment not found",
  "message": "No se encontró el pago en Mercado Pago"
}
```

## 🎭 Flujo Completo

### **Frontend → Backend → Mercado Pago → Backend → Usuario**

1. **Frontend crea preferencia**: `POST /api/payments/create-preference`
2. **Usuario paga en Mercado Pago**
3. **Frontend recibe el paymentId**
4. **Frontend llama a post-purchase**: `POST /api/payments/post-purchase`
5. **Backend verifica el pago** en Mercado Pago API
6. **Backend actualiza el rol** del usuario en Firebase
7. **Frontend recibe confirmación** y actualiza la UI

## 🔐 Asignación Automática de Roles

| Plan ID | TipoUsuario | Permisos | Precio |
|---------|-------------|-----------|--------|
| `black-user-plan` | `black` | `["dark_mode", "basic_features"]` | $1 ARS |
| `shiny-user-plan` | `shiny` | `["shiny_game", "dark_mode", "premium_features", "exclusive_content"]` | $5 ARS |
| Otro/Desconocido | `white` | `["basic_features"]` | N/A |

## 🧪 Ejemplo de Uso en Frontend

### **JavaScript/TypeScript:**
```typescript
interface PostPurchaseData {
  paymentId: string;
  userId: string;
  userEmail: string;
  userAvatar?: string;
  userName?: string;
}

const handlePostPurchase = async (purchaseData: PostPurchaseData) => {
  try {
    const response = await fetch('https://v0-steeb-api-backend.vercel.app/api/payments/post-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(purchaseData)
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Usuario actualizado a:', result.data.tipoUsuario);
      // Actualizar UI del usuario
      localStorage.setItem('userType', result.data.tipoUsuario);
      localStorage.setItem('permissions', JSON.stringify(result.data.permissions));

      // Recargar la página o actualizar el tema
      if (result.data.tipoUsuario === 'black' || result.data.tipoUsuario === 'shiny') {
        // Activar tema dark
        document.body.classList.add('dark-mode');
      }
    } else {
      console.error('❌ Error:', result.message);
      alert('Error al procesar la compra: ' + result.message);
    }
  } catch (error) {
    console.error('❌ Error de red:', error);
    alert('Error de conexión. Intenta nuevamente.');
  }
};

// Después de que el usuario vuelve de Mercado Pago:
const paymentId = new URLSearchParams(window.location.search).get('payment_id');
if (paymentId) {
  const userData = {
    paymentId: paymentId,
    userId: localStorage.getItem('userId') || 'anonymous_user',
    userEmail: localStorage.getItem('userEmail') || 'user@email.com',
    userAvatar: localStorage.getItem('userAvatar') || null,
    userName: localStorage.getItem('userName') || null
  };

  handlePostPurchase(userData);
}
```

### **React Hook:**
```typescript
import { useState, useEffect } from 'react';

export const usePostPurchase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processPurchase = async (purchaseData: PostPurchaseData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/post-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(purchaseData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message);
      }

      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { processPurchase, loading, error };
};
```

## 🎯 Cómo Usar en tu App

### **Paso 1: Después del Pago**
Cuando el usuario completa el pago en Mercado Pago y vuelve a tu app:

```javascript
// Detectar si viene de Mercado Pago
const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get('payment_id') || urlParams.get('preference_id');

if (paymentId) {
  // Obtener datos del usuario (desde localStorage, estado, etc.)
  const userData = {
    paymentId: paymentId,
    userId: getCurrentUserId(),      // Tu función para obtener el ID del usuario
    userEmail: getCurrentUserEmail(),  // Tu función para obtener el email
    userAvatar: getCurrentUserAvatar(), // Tu función para obtener el avatar
    userName: getCurrentUserName()     // Tu función para obtener el nombre
  };

  // Procesar la compra
  handlePostPurchase(userData);
}
```

### **Paso 2: Actualizar la UI**
Después de la respuesta exitosa, actualiza la interfaz:

```javascript
if (result.data.tipoUsuario === 'black' || result.data.tipoUsuario === 'shiny') {
  // Activar tema dark
  document.body.classList.add('dark-theme');

  // Mostrar notificación
  showNotification('¡Bienvenido al modo Dark Mode! 🌙', 'success');

  // Actualizar menú
  updateMenuWithDarkFeatures(true);
}
```

## 🚀 URLs de Producción

- **Backend**: `https://v0-steeb-api-backend.vercel.app/api/payments/post-purchase`
- **Testing**: `http://localhost:3001/api/payments/post-purchase` (con ngrok)

## 📚 Notas Importantes

1. **El paymentId debe ser válido** y estar aprobado en Mercado Pago
2. **El userId debe ser único** en tu sistema
3. **El webhook tradicional sigue funcionando** como método alternativo
4. **Este método es más robusto** porque tienes control total sobre los datos del usuario
5. **El tema dark se activa inmediatamente** después de la llamada exitosa