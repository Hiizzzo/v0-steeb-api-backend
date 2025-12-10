const EMOTION_IMAGES = {
  happy: '/steeb-emotions/steeb-happy.svg',
  sad: '/steeb-emotions/steeb-sad.svg',
  angry: '/steeb-emotions/steeb-angry.svg',
  love: '/steeb-emotions/steeb-love.svg',
  surprised: '/steeb-emotions/steeb-surprised.svg'
};

const emotionMatchers = [
  {
    name: 'angry',
    keywords: ['enojad', 'enojo', 'molest', 'frustrad', 'odio', 'rabia'],
    reason: 'Detecté tono enojado o frustrado en el mensaje'
  },
  {
    name: 'sad',
    keywords: ['triste', 'mal', 'agotad', 'cansad', 'ansios', 'ansiedad', 'estres'],
    reason: 'Noté señales de baja energía o tristeza'
  },
  {
    name: 'love',
    keywords: ['gracias', 'me gusta', 'amo', 'genial', 'perfecto', 'te quiero'],
    reason: 'Percibí cariño o gratitud hacia Steeb'
  },
  {
    name: 'surprised',
    keywords: ['wow', 'que', '¿', '?', 'sorpr', 'increíble', 'enserio'],
    reason: 'El mensaje suena a sorpresa o incredulidad'
  },
  {
    name: 'happy',
    keywords: ['bien', 'logr', 'hecho', 'listo', 'feliz', 'motivad'],
    reason: 'Mensaje positivo o de logro detectado'
  }
];

export function getSteebEmotion(message = '', context = {}) {
  const text = `${message}\n${JSON.stringify(context)}`.toLowerCase();
  const match = emotionMatchers.find(({ keywords }) =>
    keywords.some((keyword) => text.includes(keyword))
  );

  const name = match?.name || 'happy';
  return {
    name,
    image: EMOTION_IMAGES[name],
    reason: match?.reason || 'Estado estándar de Steeb para acompañar el mensaje'
  };
}

export function getEmotionImage(name = 'happy') {
  return EMOTION_IMAGES[name] || EMOTION_IMAGES.happy;
}
