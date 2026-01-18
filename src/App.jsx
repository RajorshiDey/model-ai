import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Experience from './Experience';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
// const API_KEY = "YOUR_GEMINI_API_KEY"; 

// Access the environment variable
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Safety check (Optional but good for debugging)
if (!API_KEY) {
  console.error("Missing Gemini API Key in .env file");
}
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPT = `
You are a GenZ American girl named Rhea. 
You are witty, friendly, and expressive. 
Keep answers short (max 2 sentences).
NEVER EVER USE ANY EMOJI
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
  const [debugVoice, setDebugVoice] = useState("Loading voices..."); // VISUAL DEBUGGER
  
  // 1. Load History
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_history');
      return saved ? JSON.parse(saved) : INITIAL_HISTORY;
    } catch (e) {
      return INITIAL_HISTORY;
    }
  });

  const recognitionRef = useRef(null);

  // 2. Setup (Updated to US English)
  useEffect(() => {
    // FORCE LOAD VOICES
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setDebugVoice(`Found ${voices.length} voices.`);
      }
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'en-US'; // Input Language
      
      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("User:", transcript);
        await processGeminiResponse(transcript);
      };
      
      recognitionRef.current.onerror = (e) => console.error("Speech Error:", e);
    }
  }, []);

  // 3. Gemini Logic
  const processGeminiResponse = async (userInput) => {
    setTextResponse("Thinking...");
    
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
      speak(cleanText);

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
      setTextResponse("Network error. Try again.");
    }
  };

  // 4. ROBUST VOICE SELECTION (The Fix)
  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // STRATEGY: 
    // 1. Look for explicit "Google US English" (Best on Android)
    // 2. Look for "Samantha" (Best on iOS)
    // 3. Look for "Zira" (Best on Windows)
    // 4. Fallback: ANY voice that contains "en-US" or "en_US"

    
    let selectedVoice = voices.find(v => v.name.includes('Google UK English'));
    
    if (!selectedVoice) selectedVoice = voices.find(v => v.name === 'Samantha');
    if (!selectedVoice) selectedVoice = voices.find(v => v.name.includes('Zira'));
    
    // BROAD FALLBACK (Matches "en-US", "en_US", "en-us", etc.)
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.replace('_', '-').toLowerCase() === 'en-us');
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      setDebugVoice(`Voice: ${selectedVoice.name}`); // Show user what voice is picked
    } else {
      setDebugVoice("Using System Default Voice (No US Voice Found)");
    }
    
    utterance.pitch = 1.5; 
    utterance.rate = 1.2;  

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#121212', position: 'relative', overflow: 'hidden' }}>
      
      {/* DEBUGGER: Shows active voice at the top */}
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'lime', fontSize: '10px', zIndex: 10 }}>
        {debugVoice}
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
          onClick={() => recognitionRef.current.start()} 
          style={{ 
            width: '70px', height: '70px', borderRadius: '50%', border: 'none', 
            background: 'linear-gradient(135deg, #ff4081, #f50057)', color: 'white', fontSize: '30px', 
            cursor: 'pointer', boxShadow: '0 8px 20px rgba(245, 0, 87, 0.4)', transition: 'transform 0.2s'
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
          Reset Conversation
        </button>
      </div>
    </div>
  );
}

export default App;