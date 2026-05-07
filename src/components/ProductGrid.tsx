import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, List, Trash2, CheckCircle2, ImageIcon, AlertCircle, Loader2, MessageSquare, ChevronRight, X } from 'lucide-react';
import { clsx } from '../lib/utils';
import { AppState, ProductItem } from '../types';

interface ProductGridProps {
  state: AppState;
  setState: (updater: AppState | ((s: AppState) => AppState), shouldRecordHistory?: boolean) => void;
  removeProduct: (id: string, e?: React.MouseEvent) => void;
  removeAllProducts: () => void;
  draggedProductIdx: number | null;
  dragOverIdx: number | null;
  dndHandlers: (idx: number) => React.DOMAttributes<HTMLDivElement> & { draggable: boolean };
}

const getStatusTitle = (p: ProductItem) => {
  if (p.status === 'done') return 'Hoàn tất - Kịch bản đã sẵn sàng';
  if (p.status === 'error') return `Lỗi: ${p.error || 'Đã có lỗi xảy ra'}`;
  if (p.status === 'ready_for_combined') return 'Chờ ghép ảnh với người mẫu';
  if (p.status === 'processing_phase1') return 'Đang xử lý nội dung AI (Giai đoạn 1)...';
  if (p.status === 'processing_phase2') return 'Đang xử lý nội dung AI (Giai đoạn 2)...';
  if (p.status.includes('processing')) return 'Đang xử lý nội dung AI...';
  return 'Chờ xử lý';
};

export function ProductGrid({
  state,
  setState,
  removeProduct,
  removeAllProducts,
  draggedProductIdx,
  dragOverIdx,
  dndHandlers
}: ProductGridProps) {
  if (state.products.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bộ sưu tập ({state.products.length})</span>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
            <button 
              onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, viewMode: 'grid' })); }}
              className={clsx(
                "p-1 rounded-md transition-all", 
                state.viewMode === 'grid' ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
              title="Lưới"
            >
              <LayoutGrid size={12} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, viewMode: 'list' })); }}
              className={clsx(
                "p-1 rounded-md transition-all", 
                state.viewMode === 'list' ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
              title="Danh sách"
            >
              <List size={12} />
            </button>
          </div>
          <button onClick={removeAllProducts} className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-widest flex items-center gap-1 transition-all active:scale-95 bg-red-500/10 px-2 py-1 rounded-md">
            <Trash2 className="size-3" /> Xóa tất cả
          </button>
        </div>
      </div>
      <p className="text-[10px] text-indigo-300/80 italic px-1 mb-3">
         * Tip: Chạm vào ảnh dưới đây để thêm mô tả chi tiết (chất liệu, tính năng) trước khi chạy AI.
      </p>
      
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div 
          key={state.viewMode}
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "circOut" }}
          className={clsx(
            state.viewMode === 'list' ? "flex flex-col gap-2" : "grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3 lg:gap-4"
          )}
        >
           {state.products.map((p, idx) => (
             state.viewMode === 'grid' ? (
              <motion.div 
                layout
                key={p.id}
                {...dndHandlers(idx)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  scale: p.status === 'done' ? [1, 1.03, 1] : 1, 
                  borderColor: p.status === 'done' ? ['rgba(255,255,255,0.1)', 'rgba(52, 211, 153, 0.8)', 'rgba(255,255,255,0.1)'] : 'rgba(255,255,255,0.1)' 
                }}
                transition={{ 
                  opacity: { delay: Math.min(idx * 0.03, 0.5), duration: 0.4 },
                  scale: { 
                    duration: 0.5, 
                    ease: "easeInOut",
                    times: [0, 0.5, 1]
                  },
                  borderColor: { duration: 0.8, ease: "easeInOut" },
                  default: { type: "spring", stiffness: 300, damping: 20 }
                }}
                whileHover={{ scale: 1.05, y: -4, borderColor: p.status === 'done' ? 'rgba(52, 211, 153, 0.5)' : 'rgba(99, 102, 241, 0.5)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setState(s => ({ ...s, selectedProductId: p.id }))}
                className={clsx(
                  "aspect-square bg-[#0c0c1e] rounded-xl relative overflow-hidden group cursor-grab active:cursor-grabbing transition-all",
                  draggedProductIdx === idx ? "opacity-50" : "",
                  dragOverIdx === idx && draggedProductIdx !== null && draggedProductIdx !== idx ? "border-indigo-500 bg-white/10 scale-105" : "",
                  state.selectedProductId === p.id ? "ring-2 ring-indigo-500 border-transparent shadow-lg shadow-indigo-500/20" : "border border-white/10"
                )}
              >
                <motion.img 
                  animate={state.selectedProductId === p.id ? { scale: [1, 1.05, 1], opacity: [1, 0.8, 1] } : { scale: 1, opacity: state.selectedProductId === p.id ? 1 : undefined }}
                  transition={{ repeat: state.selectedProductId === p.id ? Infinity : 0, duration: 2, ease: "easeInOut", opacity: { duration: 2 } }}
                  whileHover={{ scale: 1.1 }}
                  src={p.image} 
                  className={clsx("w-full h-full object-cover pointer-events-none", state.selectedProductId !== p.id && "opacity-70 group-hover:opacity-100 transition-opacity")} 
                  alt="Product" 
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }}
                />
                
                {/* STATUS INDICATORS */}
                {p.status === 'processing_phase1' && (
                  <motion.div className="absolute inset-0 bg-blue-500/20 z-0 pointer-events-none" animate={{ opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
                )}
                {p.status === 'processing_phase2' && (
                  <motion.div className="absolute inset-0 bg-purple-500/20 z-0 pointer-events-none" animate={{ opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
                )}
                <div className="absolute top-1 left-1 flex gap-1 pointer-events-none">
                  {p.status === 'done' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-emerald-500 rounded-full p-0.5 shadow-sm relative z-10" title={getStatusTitle(p)}>
                      <CheckCircle2 className="size-2.5 text-white"/>
                    </motion.div>
                  )}
                  {p.status === 'ready_for_combined' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-amber-500 rounded-full p-0.5 shadow-sm relative z-10" title={getStatusTitle(p)}>
                      <ImageIcon className="size-2.5 text-white"/>
                    </motion.div>
                  )}
                  {p.status === 'error' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-red-500 rounded-full p-0.5 shadow-sm relative z-10" title={getStatusTitle(p)}>
                      <AlertCircle className="size-2.5 text-white"/>
                    </motion.div>
                  )}
                  {p.status === 'processing_phase1' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-blue-500 rounded-full p-0.5 animate-spin shadow-sm relative z-10" title={getStatusTitle(p)}>
                      <Loader2 className="size-2.5 text-white"/>
                    </motion.div>
                  )}
                  {p.status === 'processing_phase2' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-purple-500 rounded-full p-0.5 animate-spin shadow-sm relative z-10" title={getStatusTitle(p)}>
                      <Loader2 className="size-2.5 text-white"/>
                    </motion.div>
                  )}
                  {p.status.includes('processing') && p.status !== 'processing_phase1' && p.status !== 'processing_phase2' && (
                    <div className="bg-indigo-500 rounded-full p-0.5 animate-spin shadow-sm relative z-10" title={getStatusTitle(p)}>
                      <Loader2 className="size-2.5 text-white"/>
                    </div>
                  )}
                </div>

                <div className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={(e) => removeProduct(p.id, e)} 
                     className="p-1.5 bg-black/60 hover:bg-red-500/80 rounded-md text-white transition-all active:scale-90 active:bg-red-500"
                   >
                     <X size={12}/>
                   </button>
                </div>
                
                {/* DESCRIPTION INDICATOR */}
                {p.description && p.status !== 'done' && (
                   <div className="absolute bottom-1 right-1 bg-indigo-500/80 rounded-full p-0.5 backdrop-blur-sm">
                      <MessageSquare className="size-2.5 text-white" />
                   </div>
                )}
                {!p.description && p.status === 'idle' && (
                   <div className="absolute bottom-1 right-1 bg-white/10 rounded-sm px-1 py-0.5 backdrop-blur-sm border border-white/20 z-10">
                      <span className="text-[8px] font-bold text-white uppercase opacity-80">+ Info</span>
                    </div>
                )}

                {/* TOOLTIP ON HOVER IF DONE */}
                {p.status === 'done' && p.result && (
                   <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-emerald-900/95 via-black/90 to-transparent translate-y-[101%] group-hover:translate-y-0 transition-transform duration-300 flex flex-col justify-end h-full backdrop-blur-[2px]">
                      <div className="text-[9px] text-emerald-300 font-bold mb-0.5 line-clamp-1 drop-shadow-md">Kịch bản:</div>
                      <div className="text-[8px] text-slate-200 line-clamp-5 leading-relaxed drop-shadow-md">
                         {p.result.tiktokScript}
                      </div>
                   </div>
                )}
              </motion.div>
             ) : (
              <motion.div 
                layout
                key={p.id} 
                {...dndHandlers(idx)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ 
                  opacity: 1, 
                  x: 0, 
                  borderColor: p.status === 'done' ? ['rgba(255,255,255,0.1)', 'rgba(52, 211, 153, 1)', 'rgba(255,255,255,0.1)'] : 'rgba(255,255,255,0.1)' 
                }}
                transition={{ duration: 0.5 }}
                whileHover={{ 
                  x: 4, 
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderColor: p.status === 'done' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(99, 102, 241, 0.3)'
                }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setState(s => ({ ...s, selectedProductId: p.id }))}
                className={clsx(
                  "flex items-center gap-3 bg-[#0c0c1e] p-2 rounded-xl cursor-grab active:cursor-grabbing group transition-all",
                  draggedProductIdx === idx ? "opacity-50" : "",
                  dragOverIdx === idx && draggedProductIdx !== null && draggedProductIdx !== idx ? "border-indigo-500 bg-white/5 scale-[1.01]" : "",
                  state.selectedProductId === p.id ? "ring-2 ring-indigo-500 border-transparent bg-white/5" : "border border-white/10"
                )}
              >
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative pointer-events-none">
                     <motion.img 
                       animate={state.selectedProductId === p.id ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] } : { scale: 1, opacity: state.selectedProductId === p.id ? 1 : undefined }}
                       transition={{ repeat: state.selectedProductId === p.id ? Infinity : 0, duration: 2, ease: "easeInOut" }}
                       src={p.image} 
                       className={clsx("w-full h-full object-cover", state.selectedProductId !== p.id && "opacity-80 group-hover:opacity-100 transition-opacity")} 
                       alt="Product" 
                       onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }} 
                     />
                     {p.status === 'done' && <div className="absolute top-0.5 left-0.5 bg-emerald-500 rounded-full p-0.5 relative z-10" title={getStatusTitle(p)}><CheckCircle2 className="size-2 text-white"/></div>}
                    {p.status === 'ready_for_combined' && <div className="absolute top-0.5 left-0.5 bg-amber-500 rounded-full p-0.5 relative z-10" title={getStatusTitle(p)}><ImageIcon className="size-2 text-white"/></div>}
                    {p.status === 'error' && <div className="absolute top-0.5 left-0.5 bg-red-500 rounded-full p-0.5 relative z-10" title={getStatusTitle(p)}><AlertCircle className="size-2 text-white"/></div>}
                    {p.status === 'processing_phase1' && <div className="absolute top-0.5 left-0.5 bg-blue-500 rounded-full p-0.5 animate-spin relative z-10" title={getStatusTitle(p)}><Loader2 className="size-2 text-white"/></div>}
                    {p.status === 'processing_phase2' && <div className="absolute top-0.5 left-0.5 bg-purple-500 rounded-full p-0.5 animate-spin relative z-10" title={getStatusTitle(p)}><Loader2 className="size-2 text-white"/></div>}
                    {p.status.includes('processing') && p.status !== 'processing_phase1' && p.status !== 'processing_phase2' && <div className="absolute top-0.5 left-0.5 bg-indigo-500 rounded-full p-0.5 animate-spin relative z-10" title={getStatusTitle(p)}><Loader2 className="size-2 text-white"/></div>}
                    {p.status === 'processing_phase1' && <motion.div className="absolute inset-0 bg-blue-500/20 z-0 pointer-events-none" animate={{ opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />}
                    {p.status === 'processing_phase2' && <motion.div className="absolute inset-0 bg-purple-500/20 z-0 pointer-events-none" animate={{ opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />}
                 </div>
                 
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                       <span className={clsx(
                          "text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter transition-colors select-none", 
                          p.status === 'done' ? "bg-emerald-500/10 text-emerald-400" :
                          p.status === 'error' ? "bg-red-500/10 text-red-400" :
                          "bg-indigo-500/10 text-indigo-400"
                       )} title={getStatusTitle(p)}>
                          {p.status === 'ready_for_combined' ? 'Chờ ghép ảnh' : p.status.replace('_', ' ')}
                       </span>
                       {p.description && <MessageSquare className="size-2.5 text-slate-500" />}
                    </div>
                    <div 
                      className="text-[10px] text-slate-300 truncate font-medium group" 
                      title={p.status === 'done' ? p.result?.tiktokScript : undefined}
                    >
                       {p.status === 'done' ? p.result?.tiktokScript : (p.description || "Chưa có mô tả")}
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-1 pr-1">
                    <button 
                      onClick={(e) => removeProduct(p.id, e)} 
                      className="p-1.5 text-slate-600 hover:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                       <Trash2 size={12} />
                    </button>
                    <ChevronRight size={14} className="text-slate-700 group-hover:text-indigo-400 transition-colors" />
                 </div>
              </motion.div>
             )
           ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
