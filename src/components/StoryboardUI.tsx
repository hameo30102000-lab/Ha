import React, { useState } from 'react';
import { ScanEye, Loader2, GripVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { CopyButton } from './CopyButton';
import { clsx } from '../lib/utils';

import { StoryboardShot } from '../types';

export const StoryboardUI = ({ 
  storyboard, 
  copiedText, 
  onCopy, 
  onRegenerate, 
  isRegenerating,
  onReorder
}: { 
  storyboard: StoryboardShot[], 
  copiedText: string | null, 
  onCopy: (t: string, l?: string) => void, 
  onRegenerate?: () => void, 
  isRegenerating?: boolean,
  onReorder?: (newStoryboard: StoryboardShot[]) => void
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  if (!storyboard || storyboard.length === 0) return null;

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Hide default drag image or use a custom one if needed
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    if (onReorder) {
      const newItems = [...storyboard];
      const [draggedItem] = newItems.splice(draggedIdx, 1);
      newItems.splice(idx, 0, draggedItem);
      onReorder(newItems);
    }
    
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div id="video-prompts" className="pt-4 -mt-4 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase flex items-center gap-2 font-display tracking-widest">
          <ScanEye className="size-4 text-purple-400" />
          Bảng Phân Cảnh Cinematic
        </h3>
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {onRegenerate && (
            <button 
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="h-9 px-4 text-[10px] text-amber-400 hover:text-amber-300 transition-all uppercase font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-display border border-amber-400/50 rounded-xl hover:bg-amber-400/10 hover:border-amber-400 shadow-lg shadow-amber-500/10 active:scale-95"
            >
              {isRegenerating ? <Loader2 className="size-4 animate-spin"/> : null}
              Tạo lại
            </button>
          )}
          <CopyButton 
            text={storyboard.map(s => s.prompt).join('\n\n')} 
            label="Tất cả Prompt Video" 
            copiedText={copiedText} 
            onCopy={(t, l) => onCopy(t, l)} 
            defaultText="Copy All"
            className="h-9 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] text-slate-300 hover:text-white transition-all active:scale-90 active:bg-white/10 font-display uppercase tracking-widest"
          />
        </div>
      </div>
      
      <div className="space-y-4">
        {storyboard.map((shot, idx) => (
          <motion.div 
            key={`${idx}-${shot.prompt?.substring(0, 10)}`}
            id={`video-prompt-${idx}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnter={(e) => e.preventDefault()}
            onDragEnd={() => {
              setDraggedIdx(null);
              setDragOverIdx(null);
            }}
            className={clsx(
              "flex flex-col sm:flex-row gap-4 p-4 rounded-3xl glass-card relative group scroll-mt-24 overflow-hidden border-2 cursor-grab active:cursor-grabbing",
              draggedIdx === idx ? "opacity-50 border-indigo-500/30 scale-95" : "border-white/5",
              dragOverIdx === idx ? "border-indigo-400 bg-indigo-500/10" : ""
            )}
          >
            <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex text-slate-500 hover:text-white pointer-events-auto items-center justify-center h-full w-6">
              <GripVertical className="size-4" />
            </div>
            
            <div className="w-full sm:w-48 h-32 sm:h-auto bg-black/40 rounded-2xl flex-shrink-0 border border-white/5 overflow-hidden relative flex items-center justify-center sm:ml-4">
              <span className="text-[40px] font-black text-white/5 select-none">{idx + 1}</span>
            </div>

            <div className="flex-1 space-y-3 min-w-0 pointer-events-auto">
              <div className="flex justify-between items-start gap-2">
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic break-words flex-1 cursor-text">
                  {shot.descriptionLine}
                </p>
                <CopyButton 
                  text={shot.prompt} 
                  label={`Prompt Cảnh ${idx + 1}`} 
                  copiedText={copiedText} 
                  onCopy={(t, l) => onCopy(t, l)} 
                  defaultText=""
                  className="size-11 flex items-center justify-center bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-2xl transition-all active:scale-90 shrink-0"
                />
              </div>
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 group-hover:border-indigo-500/20 transition-colors cursor-text">
                <p className="text-[11px] leading-relaxed text-slate-200 break-words">
                  {shot.prompt}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
