# Instrucciones para el Frontend Developer (Integración Mercado Pago)

Hola! 👋 Necesitamos ajustar la llamada al endpoint de creación de preferencia de pago para que el sistema de actualización de usuarios funcione automáticamente.

## El Problema
Actualmente, el backend está recibiendo pagos con `userId: "anon"` o `undefined`. Esto hace que cuando Mercado Pago confirma el pago, el backend no sepa a qué usuario actualizar a "Black" o "Shiny".

## La Solución
Necesitamos que envíes el **ID del Documento de Firebase** del usuario logueado en el campo `userId`.

### Endpoint
`POST /api/payments/create-preference`

### Payload Requerido
```json
{
  "planId": "black-user-plan",
  "userId": "owBEdOAnd6UBw4gui4gFvIRJOpj2",  // <--- IMPORTANTE: Este debe ser el ID del documento de Firebase
  "email": "usuario@ejemplo.com",
  "name": "Nombre del Usuario"
}
```

### Puntos Clave
1.  **`userId` es obligatorio**: El backend ahora rechazará la petición (Error 400) si este campo falta.
2.  **Usar el ID del Documento**: No uses el email ni el nombre del avatar como ID. Usá el ID único que genera Firebase (ej: `owBEdOAnd6UBw4gui4gFvIRJOpj2`).
3.  **Verificar antes de enviar**: Asegurate de que el usuario esté logueado y tengas su ID disponible antes de llamar a este endpoint.

## CRÍTICO: Verificar el Pago Después del Retorno

Cuando el usuario vuelve de Mercado Pago (después de pagar), **TENÉS QUE LLAMAR** a `/api/payments/verify` para que el backend actualice al usuario.

### Flujo Completo:
1. Usuario hace clic en "Pagar"
2. Frontend llama a `/api/payments/create-preference` (con el `userId`)
3. Frontend redirige al usuario a Mercado Pago
4. Usuario paga
5. Mercado Pago redirige al usuario de vuelta a tu sitio (ej: `/payments/success?payment_id=123456`)
6. **Frontend DEBE llamar a `/api/payments/verify`** con el `payment_id` que viene en la URL

### Ejemplo de Verificación:
```javascript
// En la página de retorno (ej: /payments/success)
const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get('payment_id');

if (paymentId) {
  const response = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId })
  });
  
  const result = await response.json();
  
  if (result.status === 'approved') {
    // ¡El usuario ya fue actualizado a Black automáticamente!
    console.log('Pago aprobado, usuario actualizado');
  }
}
```

Gracias! 🚀
