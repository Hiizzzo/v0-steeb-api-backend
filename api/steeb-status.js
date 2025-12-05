import 'dotenv/config';

/**
 * API endpoint to check if Steeb is sleeping
 * Returns server-side time check to prevent client manipulation
 */

// Helper: Check if Steeb should be sleeping based on Argentina time
const isSteebSleeping = () => {
    const now = new Date();
    // Get Argentina time (UTC-3)
    const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const hour = argentinaTime.getHours();
    const dayOfWeek = argentinaTime.getDay(); // 0=Sunday, 5=Friday, 6=Saturday

    // Friday (5) and Saturday (6): 3:00 AM to 9:59 AM
    if (dayOfWeek === 5 || dayOfWeek === 6) {
        return hour >= 3 && hour < 10;
    }

    // Other days: 0:00 AM to 7:59 AM
    return hour >= 0 && hour < 8;
};

export default async function handler(req, res) {
    try {
        // CORS headers
        const origin = req.headers.origin;
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:8083',
            'http://127.0.0.1:8083',
            'https://v0-steeb-api-backend.vercel.app',
            'https://steeb.vercel.app',
        ];

        if (allowedOrigins.includes(origin) || !origin) {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }

        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const isSleeping = isSteebSleeping();
        const now = new Date();
        const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));

        return res.status(200).json({
            success: true,
            isSleeping,
            serverTime: argentinaTime.toISOString(),
            hour: argentinaTime.getHours(),
            dayOfWeek: argentinaTime.getDay()
        });

    } catch (error) {
        console.error('❌ Steeb Status Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
