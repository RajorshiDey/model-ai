export default async function handler(request, response) {
  // 1. Get text from the frontend
  const { text } = request.query;

  if (!text) {
    return response.status(400).json({ error: 'Text is required' });
  }

  try {
    // 2. Call Google TTS (GTX Endpoint)
    // This runs on the SERVER, so it bypasses the CORS block you saw earlier.
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=gtx&q=${encodeURIComponent(text)}`;
    
    const externalResponse = await fetch(url);
    
    if (!externalResponse.ok) {
        throw new Error("Google blocked the request");
    }

    // 3. Convert to Buffer and Send back to Frontend
    const arrayBuffer = await externalResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    response.setHeader('Content-Type', 'audio/mp3');
    response.send(buffer);

  } catch (error) {
    console.error("TTS Proxy Error:", error);
    response.status(500).json({ error: 'Failed to generate audio' });
  }
}