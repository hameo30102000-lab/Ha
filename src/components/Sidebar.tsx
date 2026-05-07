import React, { RefObject } from 'react';
import { clsx } from '../lib/utils';
import { AppState, ProductItem } from '../types';
import { LayoutGrid, UploadCloud, X, User } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';

interface SidebarProps {
  state: AppState;
  setState: (updater: AppState | ((s: AppState) => AppState), shouldRecordHistory?: boolean) => void;
  productInputRef: RefObject<HTMLInputElement>;
  removeAllProducts: () => void;
  removeProduct: (id: string, e?: React.MouseEvent) => void;
  draggedProductIdx: number | null;
  dragOverIdx: number | null;
  dndHandlers: (idx: number) => React.DOMAttributes<HTMLDivElement> & { draggable: boolean };
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  state,
  setState,
  productInputRef,
  removeAllProducts,
  removeProduct,
  draggedProductIdx,
  dragOverIdx,
  dndHandlers,
  isOpen,
  onClose
}: SidebarProps) {
  const { user, login, logout } = useAuth();
  
  return (
    <aside className={clsx(
      "fixed lg:relative inset-y-0 left-0 w-[300px] sm:w-[320px] bg-[#0c0c1e] lg:bg-white/[0.01] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out z-[70] lg:z-30",
      isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      "lg:flex"
    )}>
      <div className="p-6 sm:p-8 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent relative">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-400 mb-2 font-display">Workspace</h2>
        <p className="text-lg font-display font-bold text-slate-100 flex items-center gap-2">
          Sản phẩm <span className="text-white/40 text-sm">({state.products.length})</span>
        </p>
        
        {/* Mobile Close Button */}
        <button 
          onClick={onClose}
          className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 active:scale-90"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        <button
          onClick={() => setState(s => ({ ...s, selectedProductId: null }))}
          className={clsx(
            "w-full flex items-center gap-3 p-3 rounded-2xl transition-all border outline-none hover:-translate-y-0.5",
            state.selectedProductId === null 
              ? "bg-indigo-600/20 border-indigo-500/50 text-white shadow-md shadow-indigo-500/10" 
              : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
          )}
        >
          <div className="size-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/10">
            <LayoutGrid size={18} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-xs font-bold">Dashboard</div>
            <div className="text-[10px] opacity-60">Quản lý chung</div>
          </div>
        </button>

        <button
          onClick={() => productInputRef.current?.click()}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 border-dashed text-slate-400 hover:bg-white/10 hover:border-indigo-500/40 transition-all group/add hover:-translate-y-0.5"
        >
          <div className="size-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 group-hover/add:border-indigo-500/30 group-hover/add:scale-110 transition-transform">
            <UploadCloud size={18} className="text-indigo-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-xs font-bold">Thêm ảnh</div>
            <div className="text-[10px] opacity-60">Tải ảnh sản phẩm mới</div>
          </div>
        </button>

        <div className="pt-4 pb-2">
          <div className="h-px bg-white/5 w-full"></div>
        </div>

        {state.products.map((p, idx) => (
          <div
            key={p.id}
            {...dndHandlers(idx)}
            onClick={() => setState(s => ({ ...s, selectedProductId: p.id }))}
            className={clsx(
              "w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all border group/item relative cursor-pointer",
              state.selectedProductId === p.id 
                ? "bg-indigo-600/10 border-indigo-500/50 text-white shadow-[0_4px_15px_rgba(99,102,241,0.1)]" 
                : "bg-transparent border-transparent text-slate-400 hover:bg-white/5",
              draggedProductIdx === idx ? "opacity-50" : "opacity-100",
              dragOverIdx === idx && draggedProductIdx !== null && draggedProductIdx !== idx ? "border-indigo-500 bg-white/5 scale-[1.02]" : "hover:-translate-y-0.5"
            )}
          >
            <div className={clsx("size-12 rounded-xl overflow-hidden bg-black/40 flex-shrink-0 cursor-grab active:cursor-grabbing relative border transition-all", state.selectedProductId === p.id ? "ring-2 ring-indigo-500 border-transparent shadow-[0_0_15px_rgba(99,102,241,0.3)]" : "border-white/10")}>
              <img src={p.image} className={clsx("size-full object-cover transition-opacity", state.selectedProductId === p.id ? "opacity-100" : "opacity-80 group-hover/item:opacity-100")} alt="Product" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }} />
              {p.modelImage && (
                <div className="absolute -bottom-1 -right-1 size-6 rounded-lg border border-white/20 overflow-hidden shadow-2xl scale-90 origin-bottom-right group-hover/item:scale-100 transition-transform">
                  <img src={p.modelImage} className="size-full object-cover" alt="Model" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }} />
                </div>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-[11px] font-bold truncate">Sản phẩm #{idx + 1}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={clsx(
                  "size-1.5 rounded-full",
                  p.status === 'done' ? "bg-emerald-500" :
                  p.status.includes('processing') ? "bg-indigo-500 animate-pulse" :
                  p.status === 'error' ? "bg-red-500" : "bg-slate-600"
                )}></div>
                <span className="text-[9px] uppercase tracking-tighter opacity-60">{p.status.replace('_', ' ')}</span>
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); removeProduct(p.id, e); }}
              className="absolute -right-1 -top-1 size-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity shadow-lg"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      
      <div className="p-6 flex flex-col gap-3 bg-black/20 border-t border-white/5">
        <button 
          onClick={removeAllProducts}
          disabled={state.products.length === 0}
          className="w-full py-3 rounded-xl border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-30 hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-red-500/20"
        >
          Xóa tất cả thư viện
        </button>
        {user && !user.isAnonymous ? (
          <button 
            onClick={logout}
            className="w-full py-3 rounded-xl border border-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <User size={14} />
            Đăng xuất ({user.displayName || user.email})
          </button>
        ) : (
          <button 
            onClick={login}
            className="w-full py-3 rounded-xl border border-indigo-500/50 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <User size={14} />
            Đăng nhập bằng Google
          </button>
        )}
      </div>
    </aside>
  );
}
