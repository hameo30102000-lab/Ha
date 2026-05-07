import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, AlertCircle, Loader2, X, FileText, Video, ImageIcon } from 'lucide-react';
import { clsx } from '../lib/utils';
import { AppState, ProductItem } from '../types';

interface MobileDockProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  productInputRef: React.RefObject<HTMLInputElement | null>;
  removeProduct: (id: string, e?: React.MouseEvent) => void;
  draggedProductIdx: number | null;
  dragOverIdx: number | null;
  dndHandlers: (idx: number) => React.DOMAttributes<HTMLDivElement> & { draggable: boolean };
  showSidebar: () => void;
  // Section Nav Props
  activeSection: string;
  scrollToSection: (id: string) => void;
  handleCopy: (text: string, label?: string) => void;
}

export function MobileDock({
  state,
  setState,
  productInputRef,
  removeProduct,
  draggedProductIdx,
  dragOverIdx,
  dndHandlers,
  showSidebar,
  activeSection,
  scrollToSection,
  handleCopy
}: MobileDockProps) {
  const selectedProduct = state.products.find(p => p.id === state.selectedProductId);
  const hasResult = selectedProduct && selectedProduct.status === 'done';

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-auto bg-[#050510]/90 backdrop-blur-3xl border-t border-white/10 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex flex-col gap-2 z-50">
      {/* Section Quick Nav - Only shown when a product is selected and has results */}
      <AnimatePresence>
        {hasResult && (
          <motion.div 
            initial={{ height: 0, opacity: 0, y: 10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 10 }}
            className="flex items-center gap-1.5 border-b border-white/5 pb-2 overflow-hidden"
          >
            <button 
              onClick={() => scrollToSection('tiktok-script')}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all active:scale-95",
                activeSection === 'tiktok-script' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white/5 text-slate-400"
              )}
            >
              <FileText size={14} /> SCRIPT
            </button>
            <div className="flex-1 flex flex-col gap-1.5 min-w-[120px]">
              <button 
                onClick={() => scrollToSection('video-prompts')}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all active:scale-95",
                  activeSection.startsWith('scene-prompt') || activeSection === 'video-prompts' ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/20" : "bg-white/5 text-slate-400"
                )}
              >
                <Video size={14} /> VIDEO
              </button>
              <div className="flex justify-center gap-2 px-1">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollToSection(`scene-prompt-${n}`);
                    }}
                    className={clsx(
                      "size-6 rounded-lg border text-[10px] font-black flex items-center justify-center transition-all active:scale-90",
                      activeSection === `scene-prompt-${n}`
                        ? "bg-fuchsia-500 border-fuchsia-400 text-white shadow-lg shadow-fuchsia-500/40 scale-110"
                        : "bg-white/5 border-white/10 text-fuchsia-400/70 hover:bg-white/10 hover:text-fuchsia-300"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={() => scrollToSection('image-prompt')}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all active:scale-95",
                activeSection === 'image-prompt' ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20" : "bg-white/5 text-slate-400"
              )}
            >
              <ImageIcon size={14} /> ẢNH
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full">
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar w-full snap-x snap-mandatory py-1">
          
          <button
             onClick={showSidebar}
             className="flex-shrink-0 size-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all text-indigo-400 snap-start"
             title="Thư viện"
          >
            <LayoutGrid size={20} />
          </button>
  
          <div className="w-px h-8 bg-white/10 self-center flex-shrink-0" />
  
          <button
             onClick={() => setState(s => ({ ...s, selectedProductId: null }))}
             className={clsx(
                "flex-shrink-0 size-11 rounded-xl border transition-all active:scale-95 snap-start flex items-center justify-center",
                state.selectedProductId === null 
                  ? "bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-500/20" 
                  : "bg-white/5 border-white/10 hover:bg-white/10"
             )}
             title="Trang chủ"
          >
            <svg className={clsx("size-5", state.selectedProductId === null ? "text-white" : "text-slate-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
          </button>
  
          <button
             onClick={() => productInputRef.current?.click()}
             className="flex-shrink-0 size-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 border-dashed overflow-hidden flex items-center justify-center transition-all active:scale-90 active:bg-white/20 snap-start"
             title="Thêm ảnh"
          >
            <svg className="size-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          </button>
  
          {state.products.map((p, index) => {
            const isActive = state.selectedProductId === p.id;
            
            return (
              <motion.div
                layout
                key={p.id}
                {...dndHandlers(index)}
                onClick={() => setState(s => ({ ...s, selectedProductId: p.id }))}
                className={clsx(
                  "relative flex-shrink-0 size-11 rounded-xl overflow-hidden transition-all cursor-pointer snap-start",
                  isActive 
                    ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#050510] bg-indigo-600 shadow-lg shadow-indigo-500/30" 
                    : "bg-white/5 border border-white/10 opacity-70 hover:opacity-100",
                  draggedProductIdx === index ? "opacity-50" : "opacity-100",
                  dragOverIdx === index && draggedProductIdx !== null && draggedProductIdx !== index ? "border-indigo-500 bg-white/10 scale-105" : "active:scale-95 active:brightness-125"
                )}
              >
                <img src={p.image} className={clsx("absolute inset-0 w-full h-full object-cover transition-opacity", isActive ? "opacity-100" : "opacity-80")} alt="" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }} />
                
                {/* Delete button for dock item - Enhanced touch target */}
                <div className="absolute top-0 right-0 z-30">
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       removeProduct(p.id, e);
                     }} 
                     className="size-6 flex items-center justify-center bg-black/60 hover:bg-red-500/80 rounded-bl-lg text-white transition-all active:scale-90 active:bg-red-500 backdrop-blur-sm"
                   >
                     <X size={10}/>
                   </button>
                </div>
  
                {p.status.includes('processing') ? (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 pointer-events-none">
                    <Loader2 className="size-3 animate-spin text-indigo-400" />
                  </div>
                ) : p.status === 'error' ? (
                  <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center z-20 pointer-events-none">
                    <AlertCircle className="size-3 text-red-400" />
                  </div>
                ) : (
                   <div className={clsx("absolute inset-0 flex items-center justify-center font-bold text-[10px] italic z-10 shadow-sm pointer-events-none", isActive ? "text-white" : "text-white/60 bg-black/40")}>
                     {p.status === 'done' || isActive ? `P${index + 1}` : ''}
                   </div>
                )}
              </motion.div>
            );
          })}
  
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#050510] to-transparent pointer-events-none z-10 rounded-r-3xl" />
      </div>
    </div>
  );
}
