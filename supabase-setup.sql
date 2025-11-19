-- 🗄️ Tabla de uso mejorada con timestamps y tracking
CREATE TABLE IF NOT EXISTS usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text UNIQUE NOT NULL,
  messages int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  last_message_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 🚀 Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_last_message ON usage(last_message_at);
CREATE INDEX IF NOT EXISTS idx_usage_messages_count ON usage(messages);

-- ⚡ Función para incrementar mensajes atómicamente (opcional pero recomendado)
CREATE OR REPLACE FUNCTION increment_user_messages(p_user_id text)
RETURNS TABLE (
  id bigint,
  user_id text,
  messages int,
  updated_at timestamptz
) AS $$
BEGIN
  INSERT INTO usage (user_id, messages, last_message_at)
  VALUES (p_user_id, 1, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    messages = usage.messages + 1,
    updated_at = NOW(),
    last_message_at = NOW(),
    metadata = jsonb_set(
      COALESCE(usage.metadata, '{}'::jsonb),
      '{last_increment}',
      NOW()::text::jsonb
    )
  RETURNING usage.id, usage.user_id, usage.messages, usage.updated_at;
END;
$$ LANGUAGE plpgsql;

-- 🔍 Función para obtener estadísticas de usuario
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id text)
RETURNS TABLE (
  total_messages int,
  remaining_messages int,
  usage_percentage numeric,
  daily_average numeric,
  is_active_today boolean,
  last_message_date timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.messages as total_messages,
    GREATEST(0, 100 - u.messages) as remaining_messages,
    ROUND((u.messages::numeric / 100) * 100, 2) as usage_percentage,
    CASE
      WHEN u.created_at = u.last_message_at THEN u.messages::numeric
      ELSE u.messages::numeric / GREATEST(1, EXTRACT(EPOCH FROM (u.last_message_at - u.created_at)) / 86400)
    END as daily_average,
    u.last_message_at >= CURRENT_DATE as is_active_today,
    u.last_message_date
  FROM usage u
  WHERE u.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 🧹 Política de seguridad (RLS) - Opcional pero recomendado
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Política para que el sistema pueda leer cualquier registro
CREATE POLICY "System can read all usage" ON usage
  FOR SELECT USING (true);

-- Política para que el sistema pueda insertar/actualizar
CREATE POLICY "System can write usage" ON usage
  FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update usage" ON usage
  FOR UPDATE USING (true);

-- 🔄 Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usage_updated_at
  BEFORE UPDATE ON usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 📊 Vista para analytics fácil
CREATE OR REPLACE VIEW usage_stats AS
SELECT
  user_id,
  messages,
  remaining_messages,
  usage_percentage,
  created_at,
  updated_at,
  last_message_at,
  CASE
    WHEN messages >= 80 THEN 'high_usage'
    WHEN messages >= 50 THEN 'medium_usage'
    WHEN messages >= 20 THEN 'low_usage'
    ELSE 'new_user'
  END as usage_tier,
  EXTRACT(EPOCH FROM (COALESCE(last_message_at, created_at) - created_at)) / 86400 as user_lifetime_days
FROM (
  SELECT
    u.*,
    GREATEST(0, 100 - u.messages) as remaining_messages,
    ROUND((u.messages::numeric / 100) * 100, 2) as usage_percentage
  FROM usage u
) combined_data;

-- 🎯 Comments para documentación
COMMENT ON TABLE usage IS 'Tabla de tracking de uso de mensajes STEEB';
COMMENT ON COLUMN usage.user_id IS 'ID único del usuario (puede ser anónimo)';
COMMENT ON COLUMN usage.messages IS 'Número total de mensajes enviados';
COMMENT ON COLUMN usage.metadata IS 'Metadata adicional en formato JSON';
COMMENT ON COLUMN usage.last_message_at IS 'Timestamp del último mensaje';
COMMENT ON FUNCTION increment_user_messages IS 'Incrementa contador de mensajes atómicamente';