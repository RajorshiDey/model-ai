import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Experience from './Experience';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 

if (!API_KEY) console.error("Missing Gemini API Key in .env file");

const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPT = `
You are Rhea, a GenZ American girl.
You are witty, friendly, and expressive.
Keep answers short (max 2 sentences).
NEVER USE EMOJIS.
CRITICAL: Start every response with an emotion tag: [HAPPY], [SAD], [ANGRY], [SURPRISED], or [NEUTRAL].
Example: [HAPPY] Oh wow! That is amazing news!
`;

const INITIAL_HISTORY = [
  { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
  { role: "model", parts: [{ text: "[HAPPY] Hi! I'm Rhea. What's up?" }] },
];

function App() {
  const [textResponse, setTextResponse] = useState("Tap the mic to chat!");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState("NEUTRAL");
  const [debugStatus, setDebugStatus] = useState("Ready");
  
  // 1. Load History
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_history');
      return saved ? JSON.parse(saved) : INITIAL_HISTORY;
    } catch (e) { return INITIAL_HISTORY; }
  });

  const recognitionRef = useRef(null);
  const audioRef = useRef(new Audio()); // Keep a single audio instance

  // 2. Setup Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'en-US'; 
      
      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("User:", transcript);
        await processGeminiResponse(transcript);
      };
      
      recognitionRef.current.onerror = (e) => {
        console.error("Speech Error:", e);
        setDebugStatus("Mic Error (Tap again)");
      };
    }
  }, []);

  // 3. MOBILE AUDIO UNLOCKER (Critical)
  const handleMicClick = () => {
    // Play silent sound to unlock mobile speakers immediately
    const audio = audioRef.current;
    if (audio) {
      audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQQAAAAAAA==";
      audio.play().catch(e => console.log("Audio unlock already active"));
    }
    
    // Start Listening
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setDebugStatus("Listening...");
    }
  };

  // 4. GEMINI LOGIC
  const processGeminiResponse = async (userInput) => {
    setTextResponse("Thinking...");
    setDebugStatus("Thinking...");
    
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const chat = model.startChat({ history: history });
      const result = await chat.sendMessage(userInput);
      const rawText = result.response.text();

      // Extract Emotion
      const emotionMatch = rawText.match(/^\[(.*?)\]/);
      let emotion = "NEUTRAL";
      let cleanText = rawText;
      if (emotionMatch) {
        emotion = emotionMatch[1];
        cleanText = rawText.replace(/^\[(.*?)\]/, "").trim();
      }

      setCurrentEmotion(emotion);
      setTextResponse(cleanText);
      setDebugStatus("Speaking...");
      
      // CALL THE PROXY
      speakViaProxy(cleanText, emotion);

      // Update History
      setHistory((prev) => {
        const updated = [...prev, 
          { role: "user", parts: [{ text: userInput }] }, 
          { role: "model", parts: [{ text: rawText }] }
        ];
        if (updated.length > 12) {
          const trimmed = [updated[0], ...updated.slice(-10)];
          localStorage.setItem('chat_history', JSON.stringify(trimmed));
          return trimmed;
        }
        localStorage.setItem('chat_history', JSON.stringify(updated));
        return updated;
      });

    } catch (error) {
      console.error("AI Error:", error);
      setTextResponse("Error. Check console.");
      setDebugStatus("Error");
    }
  };

  // 5. THE PROXY AUDIO PLAYER
  const speakViaProxy = async (text, emotion) => {
    window.speechSynthesis.cancel(); // Stop system voice

    // Truncate text slightly to prevent timeouts
    const safeText = text.length > 500 ? text.substring(0, 500) : text;
    const encodedText = encodeURIComponent(safeText);
    
    // Call YOUR Vercel API (which calls Google)
    const url = `/api/tts?text=${encodedText}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Proxy API Error");

      // 1. Get Blob
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const audio = audioRef.current;
      audio.src = blobUrl;

      // 2. Emotion Hack (Speed/Pitch)
      if (emotion === 'HAPPY') audio.playbackRate = 1.15;
      else if (emotion === 'SAD') audio.playbackRate = 0.85;
      else if (emotion === 'ANGRY') audio.playbackRate = 1.25;
      else audio.playbackRate = 1.0;

      // 3. Handlers
      audio.onplay = () => {
        setIsSpeaking(true);
        setDebugStatus("Playing (Google Proxy)");
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setDebugStatus("Ready");
        URL.revokeObjectURL(blobUrl); // Cleanup
      };

      audio.onerror = (e) => {
        console.warn("Audio Error", e);
        setIsSpeaking(false);
        fallbackSystemSpeak(text); 
      };

      await audio.play();

    } catch (error) {
      console.error("TTS Proxy Error:", error);
      // If server fails, use System Voice (Safety Net)
      fallbackSystemSpeak(text);
    }
  };

  // 6. SYSTEM VOICE FALLBACK
  const fallbackSystemSpeak = (text) => {
    setDebugStatus("Playing (System)");
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang.includes('en-US'));
    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.pitch = 1.1;
    utterance.rate = 1.1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setDebugStatus("Ready");
    };
    
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#121212', position: 'relative', overflow: 'hidden' }}>
      
      {/* Debug Info */}
      <div style={{ position: 'absolute', top: 10, left: 10, color: '#00d2ff', fontSize: '12px', zIndex: 10, fontFamily: 'monospace' }}>
        Status: {debugStatus}
      </div>

      <Canvas shadows camera={{ position: [0, 1.5, 1.5], fov: 30 }} style={{ height: '100vh' }}>
        <color attach="background" args={['#202025']} />
        <Experience isSpeaking={isSpeaking} emotion={currentEmotion} />
      </Canvas>
      
      {/* UI Overlay */}
      <div style={{ 
        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '90%', maxWidth: '400px'
      }}>
        
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.95)', padding: '15px 20px', borderRadius: '25px', 
          textAlign: 'center', color: '#222', fontWeight: '600', fontSize: '16px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)', minWidth: '250px'
        }}>
          {textResponse}
        </div>

        <button 
          onClick={handleMicClick} 
          style={{ 
            width: '70px', height: '70px', borderRadius: '50%', border: 'none', 
            background: 'linear-gradient(135deg, #00d2ff, #3a7bd5)', color: 'white', fontSize: '30px', 
            cursor: 'pointer', boxShadow: '0 8px 20px rgba(0, 210, 255, 0.4)', transition: 'transform 0.2s'
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
        >
          🎤
        </button>

        <button 
           onClick={() => { localStorage.removeItem('chat_history'); window.location.reload(); }}
           style={{ background: 'none', border: 'none', color: '#666', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default App;