import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export default async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin;
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8083',
        'http://localhost:8084',
        'http://127.0.0.1:8083',
        'https://v0-steeb-api-backend.vercel.app',
        'https://steeb.vercel.app',
    ];

    if (allowedOrigins.includes(origin) || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY not configured');
        return res.status(500).json({
            success: false,
            error: 'Transcription service not configured'
        });
    }

    try {
        // Check content type
        const contentType = req.headers['content-type'] || '';

        if (!contentType.includes('multipart/form-data')) {
            return res.status(400).json({
                success: false,
                error: 'Content-Type must be multipart/form-data'
            });
        }

        // Parse form data using the raw body
        // For Vercel/Node, we need to handle the multipart form data manually
        // or use a library like formidable

        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Extract the audio file from multipart form data
        const boundary = contentType.split('boundary=')[1];
        if (!boundary) {
            return res.status(400).json({
                success: false,
                error: 'No boundary found in Content-Type'
            });
        }

        // Parse multipart data
        const parts = parseMultipart(buffer, boundary);
        const audioPart = parts.find(p => p.name === 'audio' || p.name === 'file');

        if (!audioPart || !audioPart.data) {
            return res.status(400).json({
                success: false,
                error: 'No audio file provided'
            });
        }

        console.log('🎤 Transcribing audio...', {
            size: audioPart.data.length,
            filename: audioPart.filename || 'audio.webm'
        });

        // Create form data for OpenAI API
        const formData = new FormData();
        const audioBlob = new Blob([audioPart.data], { type: audioPart.contentType || 'audio/webm' });
        formData.append('file', audioBlob, audioPart.filename || 'audio.webm');
        formData.append('model', 'whisper-1');
        formData.append('language', 'es'); // Spanish
        formData.append('response_format', 'json');

        // Call OpenAI Whisper API
        const whisperResponse = await fetch(OPENAI_WHISPER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: formData,
        });

        if (!whisperResponse.ok) {
            const errorText = await whisperResponse.text();
            console.error('❌ Whisper API error:', whisperResponse.status, errorText);
            return res.status(whisperResponse.status).json({
                success: false,
                error: 'Transcription failed',
                details: errorText
            });
        }

        const result = await whisperResponse.json();

        console.log('✅ Transcription complete:', result.text?.substring(0, 50) + '...');

        return res.status(200).json({
            success: true,
            text: result.text,
            language: result.language || 'es'
        });

    } catch (error) {
        console.error('❌ Transcription error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}

// Helper function to parse multipart form data
function parseMultipart(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

    let start = buffer.indexOf(boundaryBuffer);

    while (start !== -1) {
        const nextBoundary = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
        if (nextBoundary === -1) break;

        const partBuffer = buffer.slice(start + boundaryBuffer.length, nextBoundary);
        const headerEnd = partBuffer.indexOf('\r\n\r\n');

        if (headerEnd !== -1) {
            const headerSection = partBuffer.slice(0, headerEnd).toString('utf8');
            const dataStart = headerEnd + 4;
            const dataEnd = partBuffer.length - 2; // Remove trailing \r\n

            const part = {
                headers: headerSection,
                data: partBuffer.slice(dataStart, dataEnd),
                name: null,
                filename: null,
                contentType: null
            };

            // Parse headers
            const nameMatch = headerSection.match(/name="([^"]+)"/);
            const filenameMatch = headerSection.match(/filename="([^"]+)"/);
            const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);

            if (nameMatch) part.name = nameMatch[1];
            if (filenameMatch) part.filename = filenameMatch[1];
            if (contentTypeMatch) part.contentType = contentTypeMatch[1].trim();

            parts.push(part);
        }

        start = nextBoundary;
    }

    return parts;
}

// Config for Vercel to handle raw body
export const config = {
    api: {
        bodyParser: false, // Disable body parser for multipart handling
    },
};
