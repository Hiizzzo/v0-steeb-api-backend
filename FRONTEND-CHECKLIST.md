# 🔍 Checklist Frontend - Verificación Antes de Comprar

## 📋 Preguntas Clave para el Frontend

### **1. 🎯 Identificación del Usuario**
**Pregunta**: ¿El frontend puede obtener el avatar del usuario correctamente?

**Cómo verificar:**
```javascript
// Ejecuta en la consola del navegador
console.log('Avatar detectado:', localStorage.getItem('userAvatar'));
console.log('Avatar DOM:', document.querySelector('.user-avatar')?.src);
console.log('Avatar profile:', document.querySelector('.profile-picture')?.src);
console.log('Avatar UI:', document.querySelector('#user-avatar')?.src);
```

**✅ Esperado**: Al menos uno debe devolver una URL de avatar de Google

---

### **2. 💾 Almacenamiento del Avatar**
**Pregunta**: ¿El avatar está guardado en localStorage o en el estado de la aplicación?

**Cómo verificar:**
```javascript
// Ejecuta en la consola
console.log('Avatar en localStorage:', localStorage.getItem('userAvatar'));
console.log('Avatar en estado global:', window.currentUser?.avatar);
console.log('Avatar en app state:', window.appState?.user?.avatar);
```

**✅ Esperado**: Debe estar guardado en localStorage o en el estado de la app

---

### **3. 🔗 URLs del Backend**
**Pregunta**: ¿Las URLs del backend son correctas?

**Cómo verificar:**
```javascript
// Ejecuta en la consola
const backendUrls = {
  webhook: 'https://v0-steeb-api-backend.vercel.app/api/payments/webhook',
  postPurchase: 'https://v0-steeb-api-backend.vercel.app/api/payments/post-purchase-simple',
  createPreference: 'https://v0-steeb-api-backend.vercel.app/api/payments/create-preference'
};

console.log('URLs del backend:', backendUrls);

// Testear que respondan
Object.entries(backendUrls).forEach(([name, url]) => {
  fetch(url, { method: 'GET' })
    .then(response => console.log(`${name}: ${response.status}`))
    .catch(error => console.error(`${name}: ${error.message}`));
});
```

**✅ Esperado**: Todas deben responder con status 200

---

### **4. 📦 Creación de Preferencia**
**Pregunta**: ¿El frontend puede crear preferencias de pago correctamente?

**Cómo verificar:**
```javascript
// Testear creación de preferencia
const testPreference = {
  planId: 'black-user-plan',
  quantity: 1,
  userId: 'test_user_123',
  email: 'test@test.com',
  name: 'Test User',
  avatarUrl: localStorage.getItem('userAvatar') || 'test-avatar-url'
};

fetch('https://v0-steeb-api-backend.vercel.app/api/payments/create-preference', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testPreference)
})
.then(response => response.json())
.then(result => {
  console.log('✅ Preferencia creada:', result.success);
  console.log('🔗 URL de pago:', result.initPoint);
})
.catch(error => {
  console.error('❌ Error creando preferencia:', error);
});
```

**✅ Esperado**: `{ success: true, initPoint: "https://..." }`

---

### **5. 🔄 Manejo del Retorno de Mercado Pago**
**Pregunta**: ¿El frontend detecta cuando el usuario vuelve de Mercado Pago?

**Cómo verificar:**
```javascript
// Ejecutar después de volver de Mercado Pago
const urlParams = new URLSearchParams(window.location.search);
console.log('Payment ID:', urlParams.get('payment_id'));
console.log('Preference ID:', urlParams.get('preference_id'));
console.log('Collection ID:', urlParams.get('collection_id'));
console.log('Status:', urlParams.get('status'));

// También verificar la URL completa
console.log('URL completa:', window.location.href);
console.log('Query params:', Object.fromEntries(urlParams.entries()));
```

**✅ Esperado**: Debe detectar al menos `payment_id`

---

### **6. 🎮 Llamada a Post-Compra**
**Pregunta**: ¿El frontend puede llamar al endpoint de post-compra con los datos correctos?

**Cómo verificar:**
```javascript
// Testear post-compra (solo para testing)
const testPostPurchase = {
  paymentId: '134300149639', // Tu paymentId real o de prueba
  userAvatar: localStorage.getItem('userAvatar') || 'https://lh3.googleusercontent.com/a/ACg8ocL1i9YzPf_1TXZeTBsN8hnhPKKq5au5IChMTgeg3WyvOBs4ng=s96-c',
  userName: 'Test User'
};

fetch('https://v0-steeb-api-backend.vercel.app/api/payments/post-purchase-simple', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testPostPurchase)
})
.then(response => response.json())
.then(result => {
  console.log('✅ Respuesta post-compra:', result);
  console.log('👤 Usuario actualizado:', result.data.tipoUsuario);
  console.log('🎨 Nuevos permisos:', result.data.permissions);
})
.catch(error => {
  console.error('❌ Error en post-compra:', error);
});
```

**✅ Esperado**: `{ success: true, data: { tipoUsuario: 'black' } }`

---

### **7. 🎨 Activación del Tema Dark**
**Pregunta**: ¿El frontend activa el tema dark cuando recibe la confirmación?

**Cómo verificar:**
```javascript
// Simular actualización exitosa
console.log('🎨 Tema dark actualizado:', document.body.classList.contains('dark-theme'));
console.log('🎨 Tema dark en localStorage:', localStorage.getItem('theme'));
console.log('🎨 Tipo de usuario:', localStorage.getItem('userType'));
console.log('🎨 Permisos:', localStorage.getItem('permissions'));
```

**✅ Esperado**: Debe mostrar `true` en al menos uno de estos

---

## 🧪 Testing Completo

### **Test 1: End-to-End Completo**
```javascript
// Ejecutar este script completo en la consola
const endToEndTest = async () => {
  console.log('🧪 Iniciando test completo...');

  // 1. Verificar avatar
  const avatar = localStorage.getItem('userAvatar');
  if (!avatar) {
    console.log('❌ No hay avatar guardado');
    return;
  }
  console.log('✅ Avatar encontrado:', avatar);

  // 2. Testear preferencia
  const prefResponse = await fetch('https://v0-steeb-api-backend.vercel.app/api/payments/create-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: 'black-user-plan',
      quantity: 1,
      userId: 'test_user',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: avatar
    })
  });

  const prefResult = await prefResponse.json();
  console.log('✅ Preferencia creada:', prefResult.success);

  if (prefResult.success) {
    console.log('🎯 El sistema está listo para producción');
    console.log('💡 Puedes proceder con una compra real');
  } else {
    console.log('❌ Problema con preferencia');
  }
};

endToEndTest();
```

---

## 📋 Checklist Final de Verificación

**Antes de comprar, responde estas preguntas:**

### **🎯 Identificación**
- [ ] ¿El avatar está disponible en localStorage o en el DOM?
- [ ] ¿El avatar coincide con uno de los usuarios existentes?
- [ ] ¿Puedes extraer el avatar fácilmente?

### **🔗 Conexión**
- [ ] ¿Las URLs del backend responden correctamente?
- [ ] ¿La creación de preferencia funciona?
- [ ] ¿La llamada a post-compra funciona?

### **🔄 Flujo**
- [ ] ¿Detectas el retorno de Mercado Pago?
- [ ] ¿La actualización del rol funciona?
- [ ] ¿El tema dark se activa correctamente?

### **🛡️ Seguridad**
- [ ] ¿Las URLs son HTTPS?
- [ ] ¿No hay datos sensibles expuestos en el frontend?
- [ ] ¿El avatar se obtiene de forma segura?

---

## 🚨 Si Algo Falla

### **Avatar no disponible:**
```javascript
// Asegúrate de guardar el avatar cuando el usuario inicia sesión
const user = auth.currentUser;
localStorage.setItem('userAvatar', user.photoURL);
```

### **URLs incorrectas:**
```javascript
// Verifica que estás usando las URLs correctas
const BACKEND_URL = 'https://v0-steeb-api-backend.vercel.app';
```

### **Tema no se activa:**
```javascript
// Activa manualmente para probar
document.body.classList.add('dark-theme');
localStorage.setItem('theme', 'dark');
```

---

## ✅ ¡Estás Listo para Comprar!

Si todas las respuestas son positivas, el sistema está completamente listo. El avatar identificará al usuario correctamente y el tema dark se activará automáticamente después de la compra. 🎉