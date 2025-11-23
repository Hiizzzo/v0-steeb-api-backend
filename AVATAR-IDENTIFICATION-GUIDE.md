# 🎯 Sistema de Identificación por Avatar - Guía Completa

## 📋 Resumen del Sistema

Ahora el backend identifica a los usuarios **exclusivamente por su avatar**, que es la forma más segura y única de identificar a cada usuario.

## 🔄 Flujo Actualizado

### **Opción 1: Webhook Automático (Recomendado)**
1. **Usuario compra** en Mercado Pago
2. **Mercado Pago envía webhook** → Tu backend
3. **Frontend envía avatar** → Webhook recibe avatar
4. **Backend busca usuario** por avatar en Firebase
5. **Usuario actualizado** a `black` o `shiny`

### **Opción 2: Post-Compra Manual**
1. **Usuario completa pago** → Vuelve a la app
2. **Frontend llama a endpoint** con paymentId y avatar
3. **Backend verifica pago** → Busca usuario por avatar
4. **Usuario actualizado** → Activación inmediata

## 🔗 Endpoints Actualizados

### **Webhook Mejorado**
```
POST /api/payments/webhook
```
```json
{
  "type": "payment",
  "data": {"id": "134300149639"},
  "avatarUrl": "https://lh3.googleusercontent.com/a/ACg8ocJ3UZ6JLKburCiiV3kgYsMKLFE0wdJkS67C9QPsbe2EF5UitA=s96-c"
}
```

### **Post-Compra Simplificado**
```
POST /api/payments/post-purchase-simple
```
```json
{
  "paymentId": "134300149639",
  "userAvatar": "https://lh3.googleusercontent.com/a/ACg8ocJ3UZ6JLKburCiiV3kgYsMKLFE0wdJkS67C9QPsbe2EF5UitA=s96-c",
  "userName": "Nombre del Usuario (opcional)"
}
```

## 🎮 Implementación en Frontend

### **Para el Webhook (Opción Automática):**

Cuando el usuario hace clic en "Comprar", antes de redirigir a Mercado Pago:

```javascript
// Antes de crear preferencia
const createPreference = async () => {
  // Obtener avatar actual del usuario
  const currentUserAvatar = localStorage.getItem('userAvatar') ||
                            document.querySelector('.user-avatar')?.src ||
                            'default-avatar-url';

  // Crear preferencia con avatar incluido
  const response = await fetch('https://v0-steeb-api-backend.vercel.app/api/payments/create-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: 'black-user-plan',
      quantity: 1,
      userId: 'user_temp_id',
      email: 'temp@email.com',
      name: 'Temp User',
      // 👇 IMPORTANTE: Incluir el avatar
      avatarUrl: currentUserAvatar
    })
  });

  const result = await response.json();

  // Redirigir a Mercado Pago
  window.location.href = result.initPoint;
};
```

### **Para Post-Compra (Opción Manual):**

Cuando el usuario vuelve de Mercado Pago:

```javascript
// Detectar retorno de Mercado Pago
const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get('payment_id');

if (paymentId) {
  // Obtener avatar del usuario
  const userAvatar = localStorage.getItem('userAvatar') ||
                     document.querySelector('.user-avatar')?.src;

  if (!userAvatar) {
    alert('Error: No se encontró el avatar del usuario');
    return;
  }

  // Enviar al backend
  fetch('https://v0-steeb-api-backend.vercel.app/api/payments/post-purchase-simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentId: paymentId,
      userAvatar: userAvatar,
      userName: localStorage.getItem('userName') || 'Usuario'
    })
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      console.log('✅ Usuario actualizado:', result.data.tipoUsuario);

      // Activar tema dark si es black o shiny
      if (result.data.tipoUsuario === 'black' || result.data.tipoUsuario === 'shiny') {
        document.body.classList.add('dark-theme');
        alert('¡Bienvenido al modo Dark Mode! 🌙');

        // Guardar en localStorage
        localStorage.setItem('userType', result.data.tipoUsuario);
        localStorage.setItem('permissions', JSON.stringify(result.data.permissions));
      }
    } else {
      console.error('❌ Error:', result.message);
      alert('Error al procesar la compra: ' + result.message);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error);
    alert('Error de conexión. Intenta nuevamente.');
  });
}
```

## 🔑 ¿Cómo Obtener el Avatar del Usuario?

### **Opción A: Desde localStorage (si ya lo guardaste):**
```javascript
const userAvatar = localStorage.getItem('userAvatar');
```

### **Opción B: Desde la UI actual:**
```javascript
const userAvatar = document.querySelector('.user-avatar')?.src ||
                 document.querySelector('.profile-picture')?.src ||
                 document.querySelector('#user-avatar')?.src;
```

### **Opción C: Desde Google/Facebook Auth:**
```javascript
// Si usas Firebase Auth
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
const userAvatar = user.photoURL;
```

### **Opción D: Desde variables globales:**
```javascript
// Si guardas el avatar en alguna parte de tu app
const userAvatar = window.currentUser?.avatar ||
                 window.appState?.user?.avatar;
```

## 🧪 Testing

### **Test con Avatares Reales:**

Usa uno de estos avatares que ya existen en tu base de datos:

```javascript
const testAvatars = [
  "https://lh3.googleusercontent.com/a/ACg8ocL1i9YzPf_1TXZeTBsN8hnhPKKq5au5IChMTgeg3WyvOBs4ng=s96-c",  // lmaokok80@gmail.com
  "https://lh3.googleusercontent.com/a/ACg8ocIdsIH51dTPGHDcxKKQGAdL_zrJ9u4sOv5CC3RlZqGnGWc_fA=s96-c",  // roberto.edad24@gmail.com
  "https://lh3.googleusercontent.com/a/ACg8ocK8DGmhT7WGk6Hn10XUh41PdlbA_QRcjrYRAVPLZ_1bBso-mGi-vw=s96-c",  // galodoublier@gmail.com
  "https://lh3.googleusercontent.com/a/ACg8ocJ3UZ6JLKburCiiV3kgYsMKLFE0wdJkS67C9QPsbe2EF5UitA=s96-c",  // santy.benitez2025@gmail.com
  "https://lh3.googleusercontent.com/a/ACg8ocLnBp-sBroyltvpWR9K6e0ehEuwrSOiO0kw-TV0ICwyt7iuy74=s96-c"   // theblexiz3010@gmail.com
];

// Testear el endpoint
fetch('https://v0-steeb-api-backend.vercel.app/api/payments/post-purchase-simple', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentId: '134300149639',
    userAvatar: testAvatars[0], // Usa el primer avatar para probar
    userName: 'Test User'
  })
});
```

## ⚠️ Notas Importantes

1. **El avatar debe coincidir exactamente**: La URL debe ser idéntica a la guardada en Firebase
2. **URLs de Google son largas**: Asegúrate de no cortarlas ni modificarlas
3. **El avatar es único**: Cada usuario tiene un avatar único, por lo que la identificación es precisa
4. **Guarda el avatar**: Cuando el usuario inicia sesión, guarda su avatar en localStorage

## 🛡️ Ventajas del Sistema Actual

✅ **Identificación precisa**: El avatar es único y no cambia
✅ **Seguro**: Mercado Pago confirma el pago, no el frontend
✅ **Robusto**: Funciona con múltiples métodos de fallback (avatar → email → userId)
✅ **Inmediato**: Post-compra actualiza al instante
✅ **Fácil de implementar**: Solo necesitas enviar el avatar en el request

## 🔄 Resolución de Problemas

### **"No se encontró usuario con ese avatar"**
- ✅ **Verifica que el avatar sea exactamente igual** al guardado en Firebase
- ✅ **Usa las herramientas de depuración** para ver los avatares disponibles
- ✅ **Revisa que no haya espacios o caracteres extraños** en la URL

### **"Avatar no disponible"**
- ✅ **Guarda el avatar cuando el usuario inicia sesión**
- ✅ **Verifica que la imagen cargue correctamente** en tu UI
- ✅ **Usa la URL completa y exacta** del avatar

## 🎉 ¡Listo para Implementar!

Configura tu frontend para que envíe el avatar y el sistema identificará automáticamente al usuario correcto. 🚀