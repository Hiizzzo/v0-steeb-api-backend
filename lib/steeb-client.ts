/**
 * SNIPPET PARA TU APP MÓVIL (React Native / Expo)
 * 
 * Copia esta función en tu proyecto móvil para conectar con el backend.
 * Asegúrate de reemplazar la URL con tu dominio real de Vercel.
 */

export const askSteeb = async (userMessage: string) => {
  try {
    // REEMPLAZA ESTO con tu dominio de Vercel cuando despliegues
    // Ejemplo: https://mi-proyecto-steeb.vercel.app/api/steeb
    const API_URL = 'https://TU-PROYECTO.vercel.app/api/steeb';

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en el servidor');
    }

    return data.reply; // Devuelve el texto de STEEB
  } catch (error) {
    console.error('Error llamando a STEEB:', error);
    return '¡Ups! STEEB se tropezó con un cable. Intenta de nuevo.';
  }
};

// Ejemplo de uso en un componente de React Native:
/*
  const handlePress = async () => {
    setLoading(true);
    const reply = await askSteeb("Tengo flojera de ir al gym");
    setSteebResponse(reply);
    setLoading(false);
  };
*/
