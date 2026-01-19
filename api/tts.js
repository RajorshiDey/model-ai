import { EdgeTTS } from 'edge-tts';

export default async function handler(req, res) {
  // 1. Get Text & Voice from the frontend request
  const { text, voice } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    // 2. Configure Edge TTS
    // Default to "Ava" (American Female) if no voice specified
    const chosenVoice = voice || 'en-US-AvaNeural'; 
    
    const tts = new EdgeTTS({
      voice: chosenVoice,
      lang: 'en-US',
    });

    // 3. Generate Audio (Base64)
    // We generate base64 directly to avoid file system issues on serverless
    const base64Audio = await tts.ttsPromise(text);
    
    // 4. Send back as audio file
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    
    res.setHeader('Content-Type', 'audio/mp3');
    res.send(audioBuffer);

  } catch (error) {
    console.error("Edge TTS Error:", error);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
}