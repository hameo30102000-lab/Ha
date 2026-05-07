import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, AlertCircle, Loader2, Sparkles, Camera, Plus, Users,
  X, CheckCircle, FileText, LayoutTemplate, ImageIcon, ArrowRight, UploadCloud, RotateCcw, Video, Clapperboard, History
} from 'lucide-react';
import { clsx } from '../lib/utils';
import { AppState, ProductItem } from '../types';
import { CopyButton } from './CopyButton';

const ABScriptsUI = React.lazy(() => import('./ABScriptsUI').then(m => ({ default: m.ABScriptsUI })));
const StoryboardUI = React.lazy(() => import('./StoryboardUI').then(m => ({ default: m.StoryboardUI })));
const ProcessingStatus = React.lazy(() => import('./ProcessingStatus').then(m => ({ default: m.ProcessingStatus })));
const Teleprompter = React.lazy(() => import('./Teleprompter'));

function LazyComponent({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <React.Suspense fallback={fallback || <div className="flex items-center justify-center p-10"><Loader2 className="animate-spin text-indigo-500" /></div>}>
      {children}
    </React.Suspense>
  );
}

interface ProductDetailProps {
  state: AppState;
  selectedProduct: ProductItem;
  removeProduct: (id: string, e?: React.MouseEvent) => void;
  setState: (updater: AppState | ((s: AppState) => AppState), shouldRecordHistory?: boolean) => void;
  // File Handlers
  handleDescriptionImageUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  removeDescriptionImage: (id: string) => void;
  handleModelImageUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  removeModelImage: (id: string) => void;
  handleCombinedImageUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  removeCombinedImage: (id: string) => void;
  // Gemini Actions
  handleSuggestDescription: () => Promise<void>;
  isSuggestingDesc: boolean;
  suggestionResult: { analysis: { clarity: string, detail: string, keywords: string }, suggestedDescription: string } | null;
  setSuggestionResult: React.Dispatch<React.SetStateAction<{ analysis: { clarity: string, detail: string, keywords: string }, suggestedDescription: string } | null>>;
  regeneratingState: { [productId: string]: { script?: boolean, caption?: boolean, storyboard?: boolean } };
  handleRegenerateScripts: (id: string) => void;
  handleRegenerateCaption: (id: string) => void;
  handleRegenerateStoryboard: (id: string) => void;
  handleRestoreHistory: (productId: string, historyId: string) => void;
  processPhase1: (id: string) => Promise<void>;
  processPhase2: (id: string) => Promise<void>;
  // UI Utils
  copiedText: string | null;
  handleCopy: (text: string, label?: string) => void;
  activeSection: string;
  setActiveSection: (id: string) => void;
}

export function ProductDetail({
  state,
  selectedProduct,
  removeProduct,
  setState,
  handleDescriptionImageUpload,
  removeDescriptionImage,
  handleModelImageUpload,
  removeModelImage,
  handleCombinedImageUpload,
  removeCombinedImage,
  handleSuggestDescription,
  isSuggestingDesc,
  suggestionResult,
  setSuggestionResult,
  regeneratingState,
  handleRegenerateScripts,
  handleRegenerateCaption,
  handleRegenerateStoryboard,
  handleRestoreHistory,
  processPhase1,
  processPhase2,
  copiedText,
  handleCopy,
  activeSection,
  setActiveSection
}: ProductDetailProps) {
  const [localDesc, setLocalDesc] = useState('');
  const [localReview, setLocalReview] = useState('');
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const descriptionImageInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const combinedInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalDesc(selectedProduct?.description || '');
    setLocalReview(selectedProduct?.userReviews || '');
  }, [selectedProduct?.id, selectedProduct?.description, selectedProduct?.userReviews]);

  const updateProductDescription = (id: string, description: string) => {
    setState(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? { ...p, description } : p)
    }), true);
  };

  const updateProductReviews = (id: string, userReviews: string) => {
    setState(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? { ...p, userReviews } : p)
    }), true);
  };

  return (
    <motion.div 
      key="result-view"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="px-5 flex flex-col gap-4 h-full pb-2 lg:pb-0 overflow-hidden"
    >
      {/* Active Item Result Frame */}
      <div className="lg:bg-gradient-to-b lg:from-white/10 lg:to-white/5 lg:rounded-3xl py-2 lg:p-5 lg:border lg:border-white/10 lg:backdrop-blur-md relative overflow-hidden flex-1 flex flex-col">
        <div className="flex flex-wrap justify-between items-start gap-2 mb-6 shrink-0">
          <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-2 py-1 rounded-full uppercase font-bold tracking-tighter flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div> Chi tiết sản phẩm
          </span>
          <div className="flex items-center gap-3">
            {selectedProduct.history && selectedProduct.history.length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setShowHistory(!showHistory)} 
                  className={clsx(
                    "text-indigo-400 hover:text-indigo-300 size-11 flex items-center justify-center rounded-xl bg-indigo-500/10 transition-all active:scale-90",
                    showHistory && "ring-2 ring-indigo-500/50 bg-indigo-500/20"
                  )}
                  title="Lịch sử nội dung tạo ra"
                >
                  <History className="size-4" />
                </button>
                
                <AnimatePresence>
                  {showHistory && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowHistory(false)}></div>
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-[120%] z-50 w-64 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                      >
                        <div className="p-3 border-b border-white/10 bg-black/20">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Lịch sử tạo</h4>
                        </div>
                        <div className="max-h-64 overflow-y-auto no-scrollbar">
                          {[...selectedProduct.history].reverse().map((h) => (
                            <div key={h.id} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors group flex items-center justify-between gap-2">
                              <div>
                                <div className="text-xs text-slate-300 font-medium">{new Date(h.timestamp).toLocaleString('vi-VN')}</div>
                                <div className="text-[10px] text-slate-500">
                                  {h.actionType === 'phase1' ? 'Tạo nội dung Tóm tắt' :
                                   h.actionType === 'phase2' ? 'Tạo mới (Anchor)' :
                                   h.actionType === 'regenerate_script' ? 'Tạo lại Kịch bản' :
                                   h.actionType === 'regenerate_caption' ? 'Tạo lại Caption' :
                                   h.actionType === 'restore_history' ? 'Khôi phục bản lưu' :
                                   h.actionType === 'regenerate_storyboard' ? 'Tạo lại Storyboard' : h.actionType}
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  handleRestoreHistory(selectedProduct.id, h.id);
                                  setShowHistory(false);
                                }}
                                className="text-[10px] font-bold px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                              >
                                Khôi phục
                              </button>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            <button onClick={() => removeProduct(selectedProduct.id)} className="text-red-400 hover:text-red-300 size-11 flex items-center justify-center rounded-xl bg-red-400/5 transition-all active:scale-90 active:brightness-150">
              <Trash2 className="size-4" />
            </button>
            <span className={clsx(
              "text-[10px] flex items-center gap-1.5 border-l border-white/20 pl-3 h-11", 
              selectedProduct.status === 'done' ? "text-emerald-400" : 
              selectedProduct.status === 'error' ? "text-red-400" : 
              selectedProduct.status === 'processing_phase1' ? "text-blue-400" : 
              selectedProduct.status === 'processing_phase2' ? "text-purple-400" : 
              selectedProduct.status === 'ready_for_combined' ? "text-amber-400" :
              "text-slate-400"
            )}>
              <div className={clsx(
                "w-1.5 h-1.5 rounded-full", 
                (selectedProduct.status.includes('processing') || selectedProduct.status === 'done') && "animate-pulse", 
                selectedProduct.status === 'done' ? "bg-emerald-400" : 
                selectedProduct.status === 'error' ? "bg-red-400" : 
                selectedProduct.status === 'processing_phase1' ? "bg-blue-400" : 
                selectedProduct.status === 'processing_phase2' ? "bg-purple-400" : 
                selectedProduct.status === 'ready_for_combined' ? "bg-amber-400" :
                "bg-slate-400"
              )}></div> 
              {selectedProduct.status === 'done' ? 'Hoàn tất' : 
                selectedProduct.status === 'error' ? 'Lỗi' : 
                selectedProduct.status === 'processing_phase1' ? 'Giai đoạn 1' : 
                selectedProduct.status === 'processing_phase2' ? 'Giai đoạn 2' : 
                selectedProduct.status === 'ready_for_combined' ? 'Chờ tải ảnh ghép' :
                'Chuẩn bị'}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedProduct.status === 'idle' || selectedProduct.status === 'error' ? (
            // 1. CONFIGURATION VIEW
            <motion.div 
              key="config" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col overflow-y-auto pr-2 no-scrollbar pb-0 lg:pb-10 min-h-0"
            >
              {selectedProduct.status === 'error' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 mb-6 text-center flex flex-col items-center gap-3 relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.1)]"
                >
                  <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0"></div>
                  <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                      <AlertCircle className="size-5 text-red-500" />
                  </div>
                  <div>
                        <h4 className="text-red-400 font-bold mb-1 text-xs uppercase tracking-wider">Xử lý thất bại</h4>
                        <p className="text-red-300/80 text-[11px] leading-relaxed">
                          {selectedProduct.error || "Có lỗi bất ngờ xảy ra trong quá trình xử lý."}
                        </p>
                        <div className="text-red-400 text-xs mt-2 text-center px-4">
                            {selectedProduct.error || "Lỗi không xác định"}
                        </div>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Mô tả Sản phẩm <span className="lowercase font-normal opacity-70">(Không bắt buộc)</span></h3>
                <div className="flex gap-2">
                    <button
                      onClick={handleSuggestDescription}
                      disabled={isSuggestingDesc || (localDesc.trim() === '' && !selectedProduct.image)}
                      className="flex-1 sm:flex-none h-11 px-4 text-[10px] text-fuchsia-400 hover:text-fuchsia-300 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 disabled:opacity-50"
                    >
                      {isSuggestingDesc ? <Loader2 className="size-4 animate-spin"/> : <Sparkles size={14} />} 
                      AI GỢI Ý
                    </button>
                    <input type="file" accept="image/*" className="hidden" ref={descriptionImageInputRef} onChange={(e) => handleDescriptionImageUpload(selectedProduct.id, e)} />
                    <button 
                      onClick={() => descriptionImageInputRef.current?.click()}
                      className="size-11 sm:w-auto sm:px-4 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 rounded-xl bg-indigo-500/10 border border-indigo-500/20"
                    >
                      <Camera size={16} /> <span className="hidden sm:inline">{selectedProduct.descriptionImage ? "Đổi ảnh" : "Tải ảnh"}</span>
                    </button>
                </div>
              </div>

              {selectedProduct.descriptionImage && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-3 relative group">
                    <div className="w-full h-32 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                      <img 
                        src={selectedProduct.descriptionImage} 
                        className="w-full h-full object-contain" 
                        alt="Description" 
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }}
                      />
                    </div>
                    <div className="absolute top-2 right-2 z-10">
                        <button 
                          onClick={() => removeDescriptionImage(selectedProduct.id)}
                          className="size-10 flex items-center justify-center bg-red-500 text-white rounded-xl shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                    </div>
                </motion.div>
              )}

              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                onBlur={() => {
                  if (localDesc !== selectedProduct.description) {
                    updateProductDescription(selectedProduct.id, localDesc);
                  }
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors placeholder:text-slate-600 resize-none h-28"
                placeholder="Cung cấp thông tin chi tiết về sản phẩm hoặc tải ảnh mô tả lên để AI đọc (ví dụ: Chống nước, tính năng nổi bật...)"
              ></textarea>

              {suggestionResult && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 p-4 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl space-y-3 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Sparkles size={40} className="text-fuchsia-400" />
                  </div>
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-fuchsia-300 uppercase tracking-widest">Gợi ý từ AI</h4>
                    <button 
                      onClick={() => setSuggestionResult(null)}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-relaxed italic border-l-2 border-fuchsia-500/30 pl-3">
                    {suggestionResult.suggestedDescription}
                  </p>
                  <button 
                    onClick={() => {
                      setLocalDesc(suggestionResult.suggestedDescription);
                      updateProductDescription(selectedProduct.id, suggestionResult.suggestedDescription);
                      setSuggestionResult(null);
                    }}
                    className="w-full py-2.5 bg-fuchsia-600 text-white text-[10px] font-bold rounded-xl hover:bg-fuchsia-500 active:scale-95 transition-all shadow-lg shadow-fuchsia-500/20 uppercase tracking-widest"
                  >
                    Áp dụng mô tả này
                  </button>
                </motion.div>
              )}

              
              <div className="mt-8 w-full py-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 mb-4">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="text-xs font-bold text-indigo-400 uppercase flex items-center gap-2">
                     <Users size={14} /> 1. Chọn người mẫu tham chiếu
                   </h3>
                   {selectedProduct.modelImage && (
                     <button 
                       onClick={() => removeModelImage(selectedProduct.id)}
                       className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase"
                     >
                       Bỏ chọn
                     </button>
                   )}
                 </div>
                 
                 <div className="relative w-full">
                   <div className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-4 -mx-1 px-1 mt-2">
                     {/* UPLOAD BUTTON */}
                     <div className="flex flex-col gap-2 shrink-0">
                        <input type="file" accept="image/*" className="hidden" ref={modelInputRef} onChange={(e) => handleModelImageUpload(selectedProduct.id, e)} />
                        <button 
                          onClick={() => modelInputRef.current?.click()}
                          className="size-20 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-slate-500 hover:text-indigo-400 group"
                        >
                          <UploadCloud size={20} className="group-hover:scale-110 transition-transform" />
                          <span className="text-[8px] font-bold uppercase">Thêm mới</span>
                        </button>
                     </div>
  
                     {/* SELECTED INDICATOR FOR NON-LIBRARY IMAGE */}
                     {selectedProduct.modelImage && !state.modelImages.includes(selectedProduct.modelImage) && (
                        <div className="relative size-20 rounded-2xl overflow-hidden border-2 border-indigo-500 ring-4 ring-indigo-500/20 shrink-0">
                           <img src={selectedProduct.modelImage} className="size-full object-cover" alt="Custom model" />
                           <div className="absolute top-1 right-1 bg-indigo-500 rounded-full p-0.5">
                              <CheckCircle size={10} className="text-white" />
                           </div>
                        </div>
                     )}
  
                     {/* Global models from App State */}
                     {state.modelImages.map((img, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            setState(s => ({
                              ...s,
                              products: s.products.map(p => p.id === selectedProduct.id ? { ...p, modelImage: img } : p)
                            }), true);
                          }}
                          className={clsx(
                            "size-20 shrink-0 rounded-2xl overflow-hidden border-2 transition-all relative group",
                            selectedProduct.modelImage === img ? "border-indigo-500 ring-4 ring-indigo-500/20" : "border-white/5 opacity-50 hover:opacity-100 hover:border-white/20"
                          )}
                        >
                          <img src={img} className="size-full object-cover" alt="Library model" />
                          {selectedProduct.modelImage === img && (
                            <div className="absolute top-1 right-1 bg-indigo-500 rounded-full p-0.5">
                              <CheckCircle size={10} className="text-white" />
                            </div>
                          )}
                        </button>
                     ))}
                   </div>
                   <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-[#0D0D14] to-transparent pointer-events-none z-10" />
                 </div>
                 
                 {!selectedProduct.modelImage && (
                    <div className="flex items-center gap-2 text-amber-400/70 py-1">
                       <AlertCircle size={10} />
                       <span className="text-[9px] font-medium italic">Vui lòng chọn 1 người mẫu để Kịch bản & Prompt được cá nhân hóa chính xác.</span>
                    </div>
                 )}
              </div>

              <div className="mt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">2. Nhận xét khách hàng (Cải thiện nội dung)</h3>
                <textarea
                  value={localReview}
                  onChange={(e) => setLocalReview(e.target.value)}
                  onBlur={() => {
                    if (localReview !== selectedProduct.userReviews) {
                      updateProductReviews(selectedProduct.id, localReview);
                    }
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors placeholder:text-slate-600 resize-none h-20"
                  placeholder="Nhập nhận xét hoặc những điểm khách hàng khen/chê để AI phân tích cảm xúc..."
                ></textarea>
              </div>

              <button 
                onClick={() => processPhase1(selectedProduct.id)}
                disabled={!selectedProduct.modelImage}
                className={clsx(
                  "mt-8 w-full h-16 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-xl flex items-center justify-center gap-3",
                  selectedProduct.modelImage 
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:brightness-110 hover:shadow-indigo-500/20" 
                    : "bg-white/5 text-white/20 cursor-not-allowed"
                )}
              >
                <Sparkles className="size-6" /> PHÂN TÍCH & TẠO PROMPT
              </button>

            </motion.div>
          ) : selectedProduct.status === 'processing_phase1' ? (
             <motion.div 
               key="processing-1" 
               initial={{ opacity: 0, scale: 0.95 }} 
               animate={{ opacity: 1, scale: 1 }} 
               className="flex flex-col items-center justify-center py-20 opacity-60"
             >
                <Loader2 className="size-16 animate-spin text-indigo-500 mb-6" />
                <h3 className="text-sm font-bold text-indigo-300 mb-2 font-display uppercase tracking-widest">Đang chạy Phase 1</h3>
                <p className="text-xs text-slate-400 max-w-sm text-center">AI đang quét tệp dữ liệu, phân tích thông số và tạo kịch bản bán hàng tối ưu...</p>
             </motion.div>
          ) : selectedProduct.status === 'ready_for_combined' ? (
             <motion.div 
               key="phase-2-ready" 
               initial={{ opacity: 0, y: 10 }} 
               animate={{ opacity: 1, y: 0 }} 
               className="flex-1 flex flex-col overflow-y-auto pr-2 no-scrollbar pb-0 lg:pb-10 min-h-0"
             >
                 <div className="space-y-6 mb-8">
                    {/* ANALYSIS RECAP */}
                    <div className="grid grid-cols-2 gap-3">
                       <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                          <div className="text-[8px] text-slate-500 uppercase tracking-widest mb-1">Loại sản phẩm</div>
                          <div className="text-[10px] text-white font-medium">{selectedProduct.result?.analysis.category}</div>
                       </div>
                       <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                          <div className="text-[8px] text-slate-500 uppercase tracking-widest mb-1">Cảm xúc chủ đạo</div>
                          <div className="text-[10px] text-white font-medium">{selectedProduct.result?.analysis.sentimentAnalysis || 'Trung tính'}</div>
                       </div>
                    </div>

                    {/* IMAGE PROMPT */}
                    <div className="bg-gradient-to-br from-indigo-900/40 to-purple-950/20 rounded-2xl p-5 border border-indigo-500/30 shadow-xl relative group">
                       <div className="flex items-center justify-between mb-3">
                         <h3 className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-1.5"><ImageIcon className="size-3.5" /> Prompt tạo ảnh nhân vật</h3>
                         <CopyButton text={selectedProduct.result?.imagePrompt || ''} copiedText={copiedText} onCopy={handleCopy} className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl text-[10px] font-bold uppercase transition-all border border-indigo-500/30" />
                       </div>
                       <div className="bg-black/30 p-4 rounded-xl border border-white/5 min-h-[80px]">
                          <p className="text-[11px] text-slate-200 leading-relaxed italic">
                             {selectedProduct.result?.imagePrompt}
                          </p>
                       </div>
                       <div className="mt-4 p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-start gap-3">
                          <AlertCircle size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-indigo-200/70 leading-relaxed">
                            Sao chép Prompt trên và sử dụng các công cụ AI (Canva, Firefly, Midjourney) để tạo ảnh sản phẩm có người mẫu trước khi sang Bước 2.
                          </p>
                       </div>
                    </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-6">
                   <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2 uppercase tracking-widest"><AlertCircle size={18}/> Bước 2: Tải ảnh ghép</h3>
                   <p className="text-xs text-amber-200/80 mb-6 leading-relaxed">
                     Lấy ảnh bạn đã tạo từ AI và tải lên đây để AI xây dựng Storyboard và Video Prompts chi tiết.
                   </p>
                   
                   <div className="flex flex-col gap-4">
                     <input type="file" accept="image/*" className="hidden" ref={combinedInputRef} onChange={(e) => handleCombinedImageUpload(selectedProduct.id, e)} />
                     
                     {selectedProduct.combinedImage ? (
                        <div className="relative group w-full max-w-[200px] h-48 rounded-xl overflow-hidden border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] mx-auto">
                           <img 
                             src={selectedProduct.combinedImage} 
                             className="w-full h-full object-cover" 
                             alt="Combined Result" 
                             onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }}
                           />
                           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => removeCombinedImage(selectedProduct.id)}
                                className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors shadow-lg"
                              >
                                <Trash2 size={16} />
                              </button>
                           </div>
                        </div>
                     ) : (
                        <button 
                          onClick={() => combinedInputRef.current?.click()}
                          className="w-full max-w-[200px] mx-auto h-48 rounded-xl border-2 border-dashed border-amber-500/50 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 transition-colors flex flex-col items-center justify-center gap-3 text-amber-500"
                        >
                           <div className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <Plus size={24} />
                           </div>
                           <span className="text-xs font-bold uppercase tracking-wider">TẢI ẢNH ĐÃ GHÉP</span>
                        </button>
                     )}
                   </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => processPhase2(selectedProduct.id)}
                    disabled={!selectedProduct.combinedImage}
                    className={clsx(
                      "flex-1 py-4 rounded-xl font-bold transition-all active:scale-95 shadow-[0_4px_20px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2",
                      selectedProduct.combinedImage ? "bg-amber-500 text-amber-950 hover:bg-amber-400 shadow-amber-500/20" : "bg-white/5 text-white/20 cursor-not-allowed"
                    )}
                  >
                    <Sparkles className="size-5" /> CHẠY PHASE 2
                  </button>
                  <button 
                    onClick={() => {
                        setState(s => ({
                            ...s,
                            products: s.products.map(p => p.id === selectedProduct.id ? { ...p, status: 'done', } : p)
                        }), true);
                    }}
                    className="flex-1 py-4 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 font-bold transition-all active:scale-95 text-xs uppercase tracking-widest"
                  >
                    Bỏ qua & Kết thúc
                  </button>
                </div>
             </motion.div>
          ) : selectedProduct.status === 'processing_phase2' ? (
             <motion.div 
               key="processing-2" 
               initial={{ opacity: 0, scale: 0.95 }} 
               animate={{ opacity: 1, scale: 1 }} 
               className="flex flex-col items-center justify-center py-20 opacity-60"
             >
                <Loader2 className="size-16 animate-spin text-amber-500 mb-6" />
                <h3 className="text-sm font-bold text-amber-400 mb-2 font-display uppercase tracking-widest">Đang chạy Phase 2</h3>
                <p className="text-xs text-slate-400 max-w-sm text-center">Đang kết hợp hình ảnh người mẫu để xây dựng bảng Storyboard và Video Prompts chi tiết...</p>
             </motion.div>
          ) : (
            // START RESULT VIEW
            <motion.div 
               key="results" 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }}
               className="relative flex flex-col flex-1 min-h-0"
            >
               <div 
                 ref={scrollContainerRef}
                 className="flex-1 overflow-y-auto pr-2 no-scrollbar pb-24 scroll-smooth min-h-0"
               >
                 <div className="flex flex-col gap-8 pb-8">
                   
                   {/* TikTok Script UI Array */}
                   {selectedProduct.result?.abScripts && selectedProduct.result.abScripts.length > 0 ? (
                     <LazyComponent fallback={<div className="h-64 rounded-xl skeleton"/>}>
                       <ABScriptsUI 
                          scripts={selectedProduct.result.abScripts} 
                          title="Kịch bản TikTok (VN)" 
                          copiedText={copiedText}
                          onCopy={(t) => handleCopy(t)}
                          isRegenerating={!!regeneratingState[selectedProduct.id]?.script}
                          onRegenerate={() => handleRegenerateScripts(selectedProduct.id)}
                       />
                     </LazyComponent>
                   ) : (
                     <motion.div 
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: 0.1 }}
                       id="tiktok-script" className="scroll-mt-24 pt-4 -mt-4"
                     >
                       <div className="flex items-center justify-between mb-2">
                         <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                            Kịch bản TikTok (VN)
                             {selectedProduct.result?.tiktokScript && (
                               <span className={clsx(
                                 "text-[9px] px-1.5 py-0.5 rounded-full normal-case flex items-center font-bold tracking-tighter",
                                 selectedProduct.result.tiktokScript.length > 400 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-slate-300"
                               )}>
                                 {selectedProduct.result.tiktokScript.length}/400 kí tự
                               </span>
                             )}
                         </h3>
                         <div className="flex items-center gap-3">
                           <button 
                             onClick={() => setIsTeleprompterOpen(true)}
                             className="px-3 py-1.5 flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 rounded-xl text-[10px] font-bold uppercase transition-all border-2 border-purple-500/30"
                           >
                             Đọc AI
                           </button>
                           <button 
                             onClick={() => handleRegenerateScripts(selectedProduct.id)}
                             disabled={regeneratingState[selectedProduct.id]?.script}
                             className="text-[10px] text-amber-400 hover:text-amber-300 transition-all uppercase font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border-2 border-amber-400/50 px-3 py-1.5 rounded-xl hover:bg-amber-400/10 hover:border-amber-400 shadow-lg shadow-amber-500/10"
                           >
                             {regeneratingState[selectedProduct.id]?.script ? <Loader2 className="size-3 animate-spin"/> : null}
                             Tạo lại
                           </button>
                           <CopyButton 
                             text={selectedProduct.result?.tiktokScript || ''} 
                             copiedText={copiedText} 
                             onCopy={(t) => handleCopy(t)} 
                             className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl text-[10px] font-bold uppercase transition-all border border-indigo-500/30"
                           />
                         </div>
                       </div>
                       <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 min-h-[140px]">
                         <p className="text-[11px] sm:text-xs leading-relaxed italic text-slate-200">
                           {selectedProduct.result?.tiktokScript}
                         </p>
                       </div>
                     </motion.div>
                   )}

                   {/* CAPTION & HASHTAG SECTION */}
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.2 }}
                     id="tiktok-caption" 
                     className="scroll-mt-24"
                   >
                     <div className="flex items-center justify-between mb-2">
                       <h3 className="text-xs font-bold text-indigo-400 uppercase flex items-center gap-2">
                          Caption & Hashtag
                          {selectedProduct.result?.tiktokCaption && (
                            <span className={clsx(
                              "text-[9px] px-1.5 py-0.5 rounded-full normal-case flex items-center",
                              selectedProduct.result.tiktokCaption.length > 150 ? "bg-red-500/20 text-red-300" : "bg-white/10 text-slate-300"
                            )}>
                              {selectedProduct.result.tiktokCaption.length}/150
                            </span>
                          )}
                       </h3>
                       <div className="flex items-center gap-3">
                         <button 
                           onClick={() => handleRegenerateCaption(selectedProduct.id)}
                           disabled={regeneratingState[selectedProduct.id]?.caption}
                           className="text-[10px] text-amber-400 hover:text-amber-300 transition-all uppercase font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border-2 border-amber-400/50 px-3 py-1.5 rounded-xl hover:bg-amber-400/10 hover:border-amber-400 shadow-lg shadow-amber-500/10"
                         >
                           {regeneratingState[selectedProduct.id]?.caption ? <Loader2 className="size-3 animate-spin"/> : null}
                           Tạo lại
                         </button>
                         <CopyButton 
                           text={selectedProduct.result?.tiktokCaption || ''} 
                           copiedText={copiedText} 
                           onCopy={(t) => handleCopy(t)} 
                           className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl text-[10px] font-bold uppercase transition-all border border-indigo-500/30"
                         />
                       </div>
                     </div>
                     <div className="bg-indigo-500/5 p-3.5 rounded-xl border border-indigo-500/20 relative group min-h-[100px]">
                       {selectedProduct.result?.tiktokCaption ? (
                         <p className="text-[11px] sm:text-xs leading-relaxed text-slate-200">
                           {selectedProduct.result.tiktokCaption}
                         </p>
                       ) : (
                         <div className="flex flex-col items-center gap-2 py-2">
                            <p className="text-[10px] text-slate-500 text-center italic">Chưa có nội dung. Vui lòng chạy lại Bước 2 để tạo Caption & Hashtag theo công thức mới.</p>
                            <button 
                              onClick={() => processPhase2(selectedProduct.id)}
                              className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg active:scale-95"
                            >
                               Chạy Bước 2
                            </button>
                         </div>
                       )}
                     </div>
                   </motion.div>

                   {/* STORYBOARD & VIDEO PROMPTS SECTION */}
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.3 }}
                     id="video-prompts" 
                     className="scroll-mt-24"
                   >
                     <div className="flex items-center justify-between mb-2">
                       <h3 className="text-xs font-bold text-fuchsia-400 uppercase flex items-center gap-2">
                          Video Prompts (Storyboard)
                       </h3>
                       <div className="flex items-center gap-3">
                         <button 
                           onClick={() => handleRegenerateStoryboard(selectedProduct.id)}
                           disabled={regeneratingState[selectedProduct.id]?.storyboard}
                            className="text-[10px] text-amber-400 hover:text-amber-300 transition-all uppercase font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border-2 border-amber-400/50 px-3 py-1.5 rounded-xl hover:bg-amber-400/10 hover:border-amber-400 shadow-lg shadow-amber-500/10"
                          >
                            {regeneratingState[selectedProduct.id]?.storyboard ? <Loader2 className="size-3 animate-spin"/> : null}
                            Tạo lại
                          </button>
                          <CopyButton 
                            text={selectedProduct.result?.videoPrompts?.join('\n\n') || ''} 
                            copiedText={copiedText} 
                            onCopy={(t) => handleCopy(t)} 
                            className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl text-[10px] font-bold uppercase transition-all border border-indigo-500/30"
                            defaultText="Sao chép toàn bộ"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {selectedProduct.result?.videoPrompts ? selectedProduct.result.videoPrompts.map((vp, index) => (
                         <div key={index} id={`scene-prompt-${index + 1}`} className="bg-fuchsia-500/5 border border-fuchsia-500/20 p-4 rounded-2xl group/vp hover:bg-fuchsia-500/10 transition-all hover:shadow-lg hover:shadow-fuchsia-500/5 relative overflow-hidden scroll-mt-24">
                            <div className="absolute top-0 left-0 w-1 h-full bg-fuchsia-500/30"></div>
                            <div className="flex justify-between items-start mb-3">
                               <div className="flex items-center gap-3">
                                 {/* PROMINENT SCENE ICON */}
                                 <div className="relative size-10 flex items-center justify-center shrink-0">
                                   <div className="absolute inset-0 bg-fuchsia-600 rounded-xl rotate-6 group-hover/vp:rotate-12 transition-transform opacity-20"></div>
                                   <div className="absolute inset-0 bg-fuchsia-500 rounded-xl -rotate-3 group-hover/vp:rotate-0 transition-transform shadow-lg shadow-fuchsia-500/20"></div>
                                   <div className="relative z-10 flex items-center justify-center text-white font-black text-lg">
                                     {index + 1}
                                   </div>
                                 </div>
                                 <div className="flex flex-col text-left">
                                   <h4 className="text-[10px] font-black text-fuchsia-200 uppercase tracking-widest">Video Prompt {index + 1}</h4>
                                   <div className="flex items-center gap-1">
                                      <Clapperboard size={10} className="text-slate-500" />
                                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">Kịch bản quay phim</span>
                                   </div>
                                 </div>
                               </div>
                               <div className="flex items-center gap-2">
                                 <CopyButton text={vp} copiedText={copiedText} onCopy={handleCopy} className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl text-[10px] font-bold uppercase transition-all border border-indigo-500/30" />
                               </div>
                            </div>
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                               <p className="text-[11px] sm:text-xs text-slate-200 leading-relaxed font-mono">"{vp}"</p>
                            </div>
                         </div>
                       )) : (
                         <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 p-4 rounded-xl text-center">
                            <p className="text-[10px] text-slate-500 italic">Chưa có Storyboard. Vui lòng tải ảnh mẫu và chạy Bước 2.</p>
                         </div>
                       )}
                     </div>
                   </motion.div>

                   {/* KLING AI IMAGE PROMPT */}
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.4 }}
                     id="image-prompt" 
                     className="pb-0 lg:pb-4 scroll-mt-24"
                   >
                     <div className="flex items-center justify-between mb-2">
                       <h3 className="text-xs font-bold text-pink-400 uppercase flex items-center gap-2">
                          Ảnh minh họa Video (Kling AI)
                       </h3>
                       {selectedProduct.result?.imagePrompt && (
                         <CopyButton text={selectedProduct.result.imagePrompt} copiedText={copiedText} onCopy={handleCopy} className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl text-[10px] font-bold uppercase transition-all border border-indigo-500/30" />
                       )}
                     </div>
                     <div className="bg-pink-500/5 p-3.5 rounded-xl border border-pink-500/20">
                       {selectedProduct.result?.imagePrompt ? (
                         <p className="text-[11px] sm:text-xs text-slate-200 leading-relaxed font-mono">
                           "{selectedProduct.result.imagePrompt}"
                         </p>
                       ) : (
                         <p className="text-[10px] text-slate-500 italic text-center py-2">Chưa có Prompt sinh ảnh.</p>
                       )}
                     </div>
                   </motion.div>
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isTeleprompterOpen && selectedProduct?.result?.tiktokScript && (
            <React.Suspense fallback={null}>
              <Teleprompter 
                script={selectedProduct.result.tiktokScript.slice(0, 400)} 
                onClose={() => setIsTeleprompterOpen(false)} 
              />
            </React.Suspense>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
