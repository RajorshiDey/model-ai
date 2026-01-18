import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Experience from './Experience';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
const API_KEY = "AIzaSyBeSxnfwBIoYCtYw3pQHPE62vPU91PEUDk"; // Put your key here
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPT = `
You are a GenZ Indian girl named Rhea. 
You speak in "English" 
You are witty, friendly, and expressive. 
Keep answers short (max 2 sentences).
CRITICAL: Start every response with an emotion tag: [HAPPY], [SAD], [ANGRY], [SURPRISED], or [NEUTRAL].
Example: [HAPPY] Arre wow! That is amazing news!
`;

// Initial Context (Always stays at index 0)
const INITIAL_HISTORY = [
  { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
  { role: "model", parts: [{ text: "[HAPPY] Hi! I am Rhea. Kya haal hai?" }] },
];

function App() {
  // --- STATE ---
  const [textResponse, setTextResponse] = useState("Tap the mic to chat!");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState("NEUTRAL");
  
  // 1. LOAD HISTORY FROM LOCAL STORAGE
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_history');
      return saved ? JSON.parse(saved) : INITIAL_HISTORY;
    } catch (e) {
      return INITIAL_HISTORY;
    }
  });

  const recognitionRef = useRef(null);

  // --- 2. SETUP SPEECH RECOGNITION ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'en-IN'; 
      
      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("User:", transcript);
        await processGeminiResponse(transcript);
      };

      recognitionRef.current.onerror = (e) => console.error("Speech Error:", e);
    } else {
      alert("Please use Google Chrome for voice features.");
    }
  }, []); // Empty dependency array ensures we don't re-bind loop

  // --- 3. GEMINI AI PROCESSING (FIXED CONTEXT LOGIC) ---
  const processGeminiResponse = async (userInput) => {
    setTextResponse("Thinking...");
    
    // CRITICAL FIX: DO NOT update history state yet.
    // We send the *current* history to the model, then append the new input via sendMessage.

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      // 1. Start Chat with EXISTING history (Previous conversation)
      const chat = model.startChat({ history: history });
      
      // 2. Send the NEW message
      const result = await chat.sendMessage(userInput);
      const rawText = result.response.text();

      // 3. Process Response (Extract Emotion)
      const emotionMatch = rawText.match(/^\[(.*?)\]/);
      let emotion = "NEUTRAL";
      let cleanText = rawText;

      if (emotionMatch) {
        emotion = emotionMatch[1];
        cleanText = rawText.replace(/^\[(.*?)\]/, "").trim();
      }

      // 4. Update UI
      setCurrentEmotion(emotion);
      setTextResponse(cleanText);
      speak(cleanText);

      // 5. UPDATE HISTORY & STORAGE (Atomic Update)
      // Now we add BOTH the User Input and Model Response at once.
      // This prevents "User, User" duplicates if the API fails.
      setHistory((prev) => {
        const newInteraction = [
          { role: "user", parts: [{ text: userInput }] },
          { role: "model", parts: [{ text: rawText }] }
        ];
        
        const updated = [...prev, ...newInteraction];

        // SLIDING WINDOW LOGIC (Keep System Prompt + Last 10)
        if (updated.length > 12) {
          // Index 0 is System. Keep it.
          // Slice the last 10 items from the end.
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
      // Note: We do NOT update history here, so the failed user message isn't saved. 
      // This keeps the conversation clean.
    }
  };

  // --- 4. TEXT TO SPEECH ---
  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
    if (hindiVoice) utterance.voice = hindiVoice;
    utterance.pitch = 1.1; 
    utterance.rate = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // --- RENDER ---
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#121212', position: 'relative' }}>
      
      <Canvas shadows camera={{ position: [0, 1.5, 1.5], fov: 30 }} style={{ height: '100vh' }}>
        <color attach="background" args={['#202025']} />
        <Experience isSpeaking={isSpeaking} emotion={currentEmotion} />
      </Canvas>
      
      {/* UI Controls */}
      <div style={{ 
        position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '90%', maxWidth: '400px'
      }}>
        
        {/* Reset Button */}
        <button 
           onClick={() => { localStorage.removeItem('chat_history'); window.location.reload(); }}
           style={{ position: 'absolute', top: -500, right: -100, padding: '5px', fontSize: '10px' }}
        >
          Reset Memory
        </button>

        <div style={{ 
          background: 'rgba(255, 255, 255, 0.9)', padding: '15px', borderRadius: '20px', 
          textAlign: 'center', color: '#333', fontWeight: '500', minWidth: '200px' 
        }}>
          {textResponse}
        </div>

        <button 
          onClick={() => recognitionRef.current.start()} 
          style={{ 
            width: '70px', height: '70px', borderRadius: '50%', border: 'none', 
            background: 'linear-gradient(135deg, #ff4081, #f50057)', color: 'white', fontSize: '30px', 
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(245, 0, 87, 0.4)'
          }}
        >
          🎤
        </button>
      </div>
    </div>
  );
}

export default App;