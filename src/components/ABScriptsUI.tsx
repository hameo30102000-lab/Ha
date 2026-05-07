import React, { useState, useEffect } from 'react';
import { TrendingUp, Loader2, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { CopyButton } from './CopyButton';
import Teleprompter from './Teleprompter';

export interface ScriptVariant {
  angle: string;
  hookText: string;
  visualAction: string;
  script: string;
  audioBPM: string;
  viralScore: number;
}

const formatScriptText = (script: string, hookText: string) => {
  if (!script || !hookText) return script || '';
  
  // Escape regex special chars
  const escapedHook = hookText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match hook at start with optional surrounding quotes and trailing punctuation
  const startRegex = new RegExp(`^\\s*["']?${escapedHook}["']?[.,!?;:\\s]*`, 'i');
  
  if (startRegex.test(script)) {
    return script.replace(startRegex, '').trim();
  }
  
  // Basic fallback
  if (script.includes(hookText)) {
    return script.replace(hookText, '').replace(/^[.,!?;:\s]+/, '').trim();
  }
  
  return script.trim();
};

export const ABScriptsUI = ({ 
  scripts, 
  copiedText, 
  onCopy, 
  onRegenerate, 
  isRegenerating 
}: { 
  scripts: ScriptVariant[], 
  copiedText: string | null, 
  onCopy: (t: string, l?: string) => void, 
  onRegenerate?: () => void, 
  isRegenerating?: boolean 
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'tabs' | 'compare'>('tabs');

  useEffect(() => {
    setActiveTab(0);
  }, [scripts]);

  const current = scripts[activeTab] || scripts[0];
  
  if (!scripts || scripts.length === 0) return null;

  return (
    <div id="tiktok-script" className="pt-4 -mt-4 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase flex items-center gap-2 font-display tracking-widest">
          <TrendingUp className="size-4 text-emerald-400" />
          A/B Test Kịch Bản (Tối ưu Viral)
        </h3>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('tabs')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 ${viewMode === 'tabs' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Cơ bản
            </button>
            <button
              onClick={() => setViewMode('compare')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 ${viewMode === 'compare' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white'}`}
            >
              So sánh
            </button>
          </div>
          {onRegenerate && (
            <button 
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="h-9 px-4 text-[10px] text-amber-400 hover:text-amber-300 transition-all uppercase font-bold tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-display border border-amber-400/50 rounded-xl hover:bg-amber-400/10 hover:border-amber-400 shadow-lg shadow-amber-500/10 active:scale-95"
            >
              {isRegenerating ? <Loader2 className="size-4 animate-spin"/> : null}
              Tạo lại
            </button>
          )}
        </div>
      </div>
      
      {viewMode === 'tabs' ? (
        <>
          <div className="w-full mb-6">
            <div className="flex flex-wrap gap-2">
              {scripts.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`px-3.5 py-2 rounded-xl text-[10px] font-bold transition-all border font-display uppercase tracking-widest active:scale-95 ${
                    activeTab === idx 
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30 ring-2 ring-indigo-500/20" 
                      : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  P{idx + 1}: {s.angle || "Khác"}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 sm:p-5 rounded-3xl space-y-5 overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-3 px-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">Voiceover Script</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold font-display uppercase shrink-0 ${current.viralScore >= 85 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      SCORE: {current.viralScore}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold font-display uppercase shrink-0 ${current.script?.length > 400 ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-slate-400'}`}>
                      {current.script?.length || 0}/400
                    </span>
                    <button 
                      onClick={() => setIsTeleprompterOpen(true)}
                      className="px-3 py-1 flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 rounded-lg text-[9px] font-bold uppercase transition-all ring-1 ring-purple-500/30"
                    >
                      <Mic size={10} /> Đọc AI
                    </button>
                  </div>
                  <CopyButton 
                    text={(current.script || '').slice(0, 400)} 
                    copiedText={copiedText} 
                    onCopy={(t) => onCopy(t)} 
                    className="px-3 py-1.5 flex items-center justify-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl text-[10px] font-bold uppercase transition-all border border-indigo-500/30"
                    defaultText="Sao chép"
                  />
                </div>
                
                <div className="bg-black/30 p-4 sm:p-5 rounded-2xl border border-white/5 min-h-[120px] relative">
                  <p className="text-[11px] sm:text-xs leading-relaxed text-slate-200 break-words">
                    <span className="text-emerald-400 font-bold font-display uppercase tracking-widest">"{current.hookText}"</span>
                    <br/><br/>
                    {formatScriptText(current.script?.slice(0, 400) || '', current.hookText)}
                  </p>
                  {current.script?.length > 400 && (
                    <div className="absolute bottom-2 right-4 text-[8px] text-red-400 font-bold uppercase tracking-tighter">
                      Đã tự động rút gọn về 400 kí tự
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {scripts.map((script, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={clsx(
                  "glass-card p-4 sm:p-5 rounded-3xl space-y-4 flex flex-col relative transition-all cursor-pointer",
                  activeTab === idx ? "ring-2 ring-indigo-500 bg-white/[0.05]" : "hover:bg-white/[0.03]"
                )}
                onClick={() => { setActiveTab(idx); setViewMode('tabs'); }}
              >
                {activeTab === idx && (
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-indigo-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Đang chọn
                  </div>
                )}
                
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Phương án {idx + 1}</div>
                    <div className="text-sm font-bold text-white leading-tight">{script.angle || "Khác"}</div>
                  </div>
                  <div className={`text-[10px] px-2 py-1 rounded-lg font-bold font-display uppercase shrink-0 ${script.viralScore >= 85 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {script.viralScore} / 100
                  </div>
                </div>

                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 flex-1 relative overflow-y-auto max-h-[250px] custom-scrollbar">
                  <p className="text-[11px] sm:text-xs leading-relaxed text-slate-300 break-words">
                    <span className="text-emerald-400 font-bold font-display uppercase tracking-widest">"{script.hookText}"</span>
                    <br/><br/>
                    {formatScriptText(script.script?.slice(0, 400) || '', script.hookText)}
                  </p>
                </div>
                
                <div className="pt-2 flex justify-between items-center border-t border-white/5">
                  <div className="text-[9px] text-slate-500 font-bold uppercase">
                    {(script.script || '').length}/400
                  </div>
                  <CopyButton 
                    text={(script.script || '').slice(0, 400)} 
                    copiedText={copiedText} 
                    onCopy={(t) => onCopy(t)} 
                    className="px-3 py-1.5 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-bold uppercase transition-all"
                    defaultText="Copy Script"
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {isTeleprompterOpen && (
        <Teleprompter 
          script={current.script?.slice(0, 400) || ''} 
          onClose={() => setIsTeleprompterOpen(false)} 
        />
      )}
    </div>
  );
};
