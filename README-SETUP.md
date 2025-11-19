# 🚀 STEEB API Backend - Guía de Setup Completa

## ✨ Características Implementadas

- **🤖 Integración con DeepSeek IA** - Coaching motivacional inteligente
- **🗄️ Tracking con Supabase** - Persistencia y límites de uso
- **💾 Cache en memoria** - Mejor rendimiento para usuarios frecuentes
- **🔄 Reintentos automáticos** - Alta disponibilidad
- **📊 Logging estructurado** - Monitoreo y debugging fácil
- **⚡ Timeout protection** - Sin esperas infinitas
- **🛡️ Validación robusta** - Seguridad y calidad
- **📈 Metadata avanzada** - Analytics y estadísticas

## 🗄️ Setup de Supabase

### 1. Ejecutar el SQL completo
Copia y ejecuta el contenido de `supabase-setup.sql` en el panel de SQL de Supabase.

### 2. Configurar variables de entorno
En tu proyecto Supabase → Settings → API:
- `SUPABASE_URL` = Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = service_role secret

## ⚙️ Configuración en Vercel

### Variables de Entorno
Ve a Settings → Environment Variables:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
DEEPSEEK_API_KEY=sk-tu-deepseek-api-key
```

### Deploy Automático
Los cambios se deployan automáticamente cuando haces push a GitHub.

## 📡 Formato del API

### Request
```javascript
fetch('/api/steeb', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Necesito motivación para empezar mi día!",
    userId: "user-123"  // Opcional: se genera automáticamente si no se proporciona
  })
})
```

### Response (Ejemplo)
```json
{
  "success": true,
  "data": {
    "reply": "¡Fire! ¡A darle con todo! 🚀 Hoy es tu día para romperla.",
    "user": {
      "messageCount": 5,
      "remainingMessages": 95,
      "usagePercentage": 5
    },
    "performance": {
      "processingTime": "450ms",
      "cached": false
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Message is required"
}
```

## 🎯 Características Técnicas

### Cache Inteligente
- **TTL:** 5 minutos para datos de usuario
- **Cleanup automático:** cada 10 minutos
- **Hit rate tracking:** en logs de performance

### Reintentos con Backoff Exponencial
- **Max reintentos:** 3
- **Delay inicial:** 1 segundo
- **Strategy:** exponential backoff

### Rate Limiting
- **Límite por usuario:** 100 mensajes
- **Validación:** preventiva + persistente
- **Response friendly:** mensajes STEEB-style

### Logging Estructurado
```bash
[2024-01-15T10:30:45.123Z] INFO [userId: user-123]: Processing request {"messageLength": 45}
[2024-01-15T10:30:45.567Z] INFO [userId: user-123]: AI response generated successfully {"responseLength": 89}
[2024-01-15T10:30:46.001Z] INFO [userId: user-123]: Message count updated {"newCount": 6}
```

## 🔧 Configuración Avanzada

### Variables de configuración (en el código)
```typescript
const CONFIG = {
  MESSAGE_LIMIT: 100,           // Límite de mensajes por usuario
  MAX_MESSAGE_LENGTH: 2000,     // Max chars por mensaje
  MAX_RETRIES: 3,               // Reintentos para operaciones
  RETRY_DELAY: 1000,            // Delay inicial (ms)
  CACHE_TTL: 5 * 60 * 1000,     // TTL del cache (5 min)
  AI_TIMEOUT: 30000,            // Timeout para IA (30 seg)
}
```

### System Prompts Dinámicos
- **Primer mensaje:** Bienvenida especial
- **50+ mensajes:** Celebración de constancia
- **80+ mensajes:** Motivación de cierre
- **Mensajes contextuales:** Frases STEEB rotativas

## 📊 Monitoreo y Analytics

### Queries Útiles para Supabase

#### Usuarios más activos
```sql
SELECT user_id, messages, last_message_at
FROM usage
ORDER BY messages DESC
LIMIT 10;
```

#### Analytics diarios
```sql
SELECT
  DATE(last_message_at) as date,
  COUNT(*) as active_users,
  SUM(messages) as total_messages
FROM usage
WHERE last_message_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(last_message_at)
ORDER BY date DESC;
```

#### Distribución de uso
```sql
SELECT
  CASE
    WHEN messages >= 80 THEN 'Power Users'
    WHEN messages >= 50 THEN 'Active Users'
    WHEN messages >= 20 THEN 'Regular Users'
    ELSE 'New Users'
  END as tier,
  COUNT(*) as count,
  AVG(messages) as avg_messages
FROM usage
GROUP BY tier
ORDER BY avg_messages DESC;
```

## 🚀 Testing Manual

### Test Básico
```bash
curl -X POST http://localhost:3000/api/steeb \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola STEEB!", "userId": "test-user"}'
```

### Test de Límites
```bash
# Loop para testear límite de 100 mensajes
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/steeb \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Test $i\", \"userId\": \"limit-test\"}"
  echo ""
done
```

### Test de Error Handling
```bash
# Request inválido
curl -X POST http://localhost:3000/api/steeb \
  -H "Content-Type: application/json" \
  -d '{"message": ""}'  # Mensaje vacío

# Sin body
curl -X POST http://localhost:3000/api/steeb \
  -H "Content-Type: application/json"
```

## 🛠️ Debugging

### Ver Logs en Vercel
1. Functions → `/api/steeb` → Logs
2. Filtrar por userId para seguimiento específico

### Common Issues
- **429 Too Many Requests:** Espera entre requests
- **500 Server Error:** Revisa variables de entorno
- **503 Service Unavailable:** Problema con DeepSeek API

## 📈 Performance Tips

1. **Cache hits:** Usuarios frecuentes obtienen respuesta rápida
2. **Batch operations:** Considerar updates en batch para alta carga
3. **Database connection pooling:** Configurado automáticamente en Supabase
4. **CDN caching:** Vercel edge caching para respuestas cacheables

## 🔒 Security Considerations

- **Input sanitization:** Automatic para todos los inputs
- **Rate limiting:** Por usuario a nivel de aplicación
- **SQL injection protection:** Usando Supabase client
- **API key management:** Variables de entorno only

## 🎯 Próximos Mejoras (Opcionales)

1. **Analytics dashboard** con tiempo real
2. **A/B testing** para system prompts
3. **User segmentation** por patrones de uso
4. **Scheduled tasks** para reset diario
5. **Webhooks** para eventos importantes
6. **GraphQL endpoint** para frontend apps

---

¡Tu backend está listo para producción con STEEB! 💪🔥

Made with 🔥 by Claude Code