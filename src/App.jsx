import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Experience from './Experience';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
// TODO: Replace with your actual Gemini API Key
const API_KEY = "AIzaSyB4AnJyO_k-7e2kyfsmnZtitiFoFOQ8Yvc"; 
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPT = `
You are a GenZ Indian girl named Rhea. 
You speak in "Hinglish" (Hindi + English). 
You are witty, friendly, and expressive. 
Keep answers short (max 2 sentences).
CRITICAL: Start every response with an emotion tag: [HAPPY], [SAD], [ANGRY], [SURPRISED], or [NEUTRAL].
Example: [HAPPY] Arre wow! That is amazing news!
`;

function App() {
  // --- STATE ---
  const [textResponse, setTextResponse] = useState("Tap the mic to chat!");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState("NEUTRAL");
  const [history, setHistory] = useState([
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "[HAPPY] Hi! I am Rhea. Kya haal hai?" }] },
  ]);

  const recognitionRef = useRef(null);

  // --- 1. SETUP SPEECH RECOGNITION ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'en-IN'; // Indian Accent Input
      
      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("User:", transcript);
        await processGeminiResponse(transcript);
      };

      recognitionRef.current.onerror = (e) => console.error("Speech Error:", e);
    } else {
      alert("Please use Google Chrome for voice features.");
    }
  }, [history]);

  // --- 2. GEMINI AI PROCESSING ---
  const processGeminiResponse = async (userInput) => {
    setTextResponse("Thinking...");
    
    // Update local history
    const newHistory = [...history, { role: "user", parts: [{ text: userInput }] }];
    setHistory(newHistory);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const chat = model.startChat({ history: newHistory });
      
      const result = await chat.sendMessage(userInput);
      const rawText = result.response.text();

      // Extract Emotion Tag
      const emotionMatch = rawText.match(/^\[(.*?)\]/);
      let emotion = "NEUTRAL";
      let cleanText = rawText;

      if (emotionMatch) {
        emotion = emotionMatch[1];
        cleanText = rawText.replace(/^\[(.*?)\]/, "").trim();
      }

      // Update State
      setCurrentEmotion(emotion);
      setTextResponse(cleanText);
      speak(cleanText);

      // Save Model Response
      setHistory([...newHistory, { role: "model", parts: [{ text: rawText }] }]);

    } catch (error) {
      console.error("AI Error:", error);
      setTextResponse("Network error. Check console.");
    }
  };

  // --- 3. TEXT TO SPEECH ---
  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find Indian Voice
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
      
      {/* <Canvas shadows camera={{ position: [0, 0, 4], fov: 40 }}>
        <color attach="background" args={['#202025']} />
        <Experience isSpeaking={isSpeaking} emotion={currentEmotion} />
      </Canvas> */}

      {/* fov: 30 creates a nice "portrait lens" effect (less distortion) */}
{/* position: [0, 1.5, 1.5] -> X=0 (Center), Y=1.5 (Face Height), Z=1.5 (Close Zoom) */}
<Canvas shadows camera={{ position: [0, 1.5, 1.5], fov: 30 }} style={{ height: '100vh' }}>
  <color attach="background" args={['#202025']} />
  <Experience isSpeaking={isSpeaking} emotion={currentEmotion} />
</Canvas>
      
      {/* UI Controls */}
      <div style={{ 
        position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '90%', maxWidth: '400px'
      }}>
        
        {/* Text Bubble */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.9)', padding: '15px', borderRadius: '20px', 
          textAlign: 'center', color: '#333', fontWeight: '500', minWidth: '200px' 
        }}>
          {textResponse}
        </div>

        {/* Mic Button */}
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