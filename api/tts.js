import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  const { text, voice } = req.query;

  if (!text) return res.status(400).json({ error: 'Text required' });

  // Default to Ava (American Female) if no voice provided
  const VOICE = voice || 'en-US-AvaNeural';

  try {
    const audioBuffer = await generateEdgeAudio(text, VOICE);
    res.setHeader('Content-Type', 'audio/mp3');
    res.send(audioBuffer);
  } catch (error) {
    console.error("Edge TTS API Error:", error);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
}

// --- HELPER FUNCTION: Talk to MS Edge via WebSocket ---
function generateEdgeAudio(text, voice) {
  return new Promise((resolve, reject) => {
    // 1. Connect to Edge WebSocket
    const ws = new WebSocket('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4-EA85-432D-A9D3-3202F2CC54E3');
    const requestId = uuidv4();
    const audioChunks = [];

    ws.on('open', () => {
      // 2. Send Configuration
      ws.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);

      // 3. Send SSML (The Text)
      const ssml = `
        <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
          <voice name='${voice}'>
            <prosody pitch='+0Hz' rate='+0%'>${text}</prosody>
          </voice>
        </speak>
      `;
      
      ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toString()}\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // 4. Collect Audio Data
        // Binary messages contain a small header we need to strip, 
        // but finding the "Path:audio" text header is complex.
        // For Edge, usually the first 2 bytes are metadata, followed by headers.
        // We simply search for the start of the MP3 frame or append blindly for now.
        // A safer check is looking for the binary marker. 
        
        // Simple Parser: Check if it's audio data
        const textData = data.toString();
        if (textData.includes("Path:audio")) {
             // The binary data starts after the header. 
             // Header ends with \r\n\r\n.
             const headerEnd = data.indexOf(Buffer.from("\r\n\r\n"));
             if (headerEnd !== -1) {
                 audioChunks.push(data.slice(headerEnd + 4));
             }
        }
      }
      
      // Check for End of Audio
      if (!isBinary && data.toString().includes("Path:turn.end")) {
        ws.close();
      }
    });

    ws.on('close', () => {
      // 5. Combine and Resolve
      resolve(Buffer.concat(audioChunks));
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}