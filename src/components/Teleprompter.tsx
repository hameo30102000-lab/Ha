import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, RotateCcw, Volume2, Mic } from 'lucide-react';
import clsx from 'clsx';

interface TeleprompterProps {
  script: string;
  onClose: () => void;
}

export default function Teleprompter({ script, onClose }: TeleprompterProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5); // speed multiplier
  const [fontSize, setFontSize] = useState(48);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synth = window.speechSynthesis;
  // A simple state to force re-render if needed
  const [, setTick] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const scrollText = (time: number) => {
      if (isPlaying && scrollRef.current) {
        const deltaTime = time - lastTime;
        // pixel per millisecond based on speed. speed 1 = ~30px per sec
        const scrollAmount = (deltaTime / 1000) * 40 * speed;
        scrollRef.current.scrollTop += scrollAmount;
      }
      lastTime = time;
      animationFrameId = requestAnimationFrame(scrollText);
    };

    animationFrameId = requestAnimationFrame(scrollText);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, speed]);

  const toggleVoice = () => {
    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.1;
      utterance.onend = () => setIsSpeaking(false);
      synth.speak(utterance);
      setIsSpeaking(true);
      // Auto play teleprompter
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      synth.cancel();
    };
  }, []);

  const reset = () => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
    }
    setIsPlaying(false);
    synth.cancel();
    setIsSpeaking(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed inset-0 z-[100] bg-black text-white flex flex-col font-sans"
      >
        <div className="flex-none p-4 bg-zinc-900 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="size-12 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition-all shadow-lg shadow-indigo-500/20"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>
            <button
                onClick={reset}
                className="size-12 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition-all"
            >
                <RotateCcw size={20} />
            </button>

            <button
               onClick={toggleVoice}
               className={clsx(
                   "px-4 h-12 rounded-full flex items-center gap-2 font-bold transition-all transition-colors",
                   isSpeaking ? "bg-purple-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-slate-300"
               )}
            >
                {isSpeaking ? <Volume2 size={20} /> : <Mic size={20} />}
                <span className="hidden sm:inline">{isSpeaking ? 'Đang đọc AI...' : 'Đọc mẫu AI'}</span>
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 hidden sm:flex">
                <span className="text-xs uppercase font-bold text-slate-500">Tốc độ</span>
                <input 
                  type="range" min="0.5" max="3" step="0.1" value={speed} 
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="accent-indigo-500"
                />
            </div>
            <div className="flex items-center gap-3 hidden sm:flex">
                <span className="text-xs uppercase font-bold text-slate-500">Cỡ chữ</span>
                <input 
                  type="range" min="20" max="120" step="4" value={fontSize} 
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="accent-indigo-500"
                />
            </div>

            <button onClick={() => { reset(); onClose(); }} className="size-12 rounded-full bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all ml-4">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Teleprompter Screen */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto relative no-scrollbar"
        >
          {/* Top indicator line */}
          <div className="sticky top-[30%] left-0 right-0 h-px bg-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] z-10 pointer-events-none" />
          <div className="sticky top-[30%] left-4 size-3 bg-red-500 rounded-full z-10 -mt-1.5 shadow-[0_0_10px_rgba(239,68,68,0.8)] pointer-events-none" />

          <div className="max-w-4xl mx-auto px-8 sm:px-12 w-full pb-[80vh] pt-[30vh]">
            <p 
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
                className={clsx(
                    "font-bold text-slate-300 font-sans tracking-tight transition-all",
                    isPlaying ? "opacity-100" : "opacity-60"
                )}
            >
                {script}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
