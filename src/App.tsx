import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { 
  Camera, UploadCloud, X, Loader2, Sparkles, 
  CheckCircle2, AlertCircle, LayoutGrid, RotateCcw,
  MessageSquare, FileText, Video, ImageIcon,
  ChevronRight, Hash, Trash2, User, Images, List, ArrowRight, Undo2, Redo2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './providers/AuthProvider';
import { useAppStorage } from './lib/storage';
import { useProductDnD } from './lib/hooks';
import { generatePhase1, generatePhase2, regenerateScripts, regenerateCaption, regenerateStoryboard, suggestDescriptionImprovements } from './lib/gemini';
import { resizeImage, clsx, removeVietnameseTones } from './lib/utils';
import { ProductItem, ProductResult, StoryboardShot } from './types';

// Components
import { CopyButton } from './components/CopyButton';
import { Sidebar } from './components/Sidebar';
import { ProductGrid } from './components/ProductGrid';
import { ProductDetail } from './components/ProductDetail';

import { MobileDock } from './components/MobileDock';

// Lazy loaded components for better initial load time
const ABScriptsUI = lazy(() => import('./components/ABScriptsUI').then(m => ({ default: m.ABScriptsUI })));
const StoryboardUI = lazy(() => import('./components/StoryboardUI').then(m => ({ default: m.StoryboardUI })));
const ProcessingStatus = lazy(() => import('./components/ProcessingStatus').then(m => ({ default: m.ProcessingStatus })));

// Loading Suspense Wrapper
function LazyComponent({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-10"><Loader2 className="animate-spin text-indigo-500" /></div>}>
      {children}
    </Suspense>
  );
}

export default function App() {
  const { user, login } = useAuth();
  const { state, setState, clearStorage, undo, redo, canUndo, canRedo } = useAppStorage();
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);
  const [activeSection, setActiveSection] = useState('tiktok-script');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const handleMainContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    
    if (currentScrollY < 0 || currentScrollY > e.currentTarget.scrollHeight - e.currentTarget.clientHeight) {
      return;
    }

    if (currentScrollY > lastScrollY && currentScrollY > 50) {
      if (isHeaderVisible) setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
    }
    setLastScrollY(currentScrollY);
  };

  const scrollToSection = (id: string) => {
     const element = document.getElementById(id);
     if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSection(id);
     }
  };
  const [regeneratingState, setRegeneratingState] = useState<{ [productId: string]: { script?: boolean, caption?: boolean, storyboard?: boolean } }>({});
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
    isOpen: false, message: '', onConfirm: () => {}
  });

  // localHashtags state
  const [localHashtags, setLocalHashtags] = useState('');
  const [isSuggestingDesc, setIsSuggestingDesc] = useState(false);
  const [suggestionResult, setSuggestionResult] = useState<{ analysis: { clarity: string, detail: string, keywords: string }, suggestedDescription: string } | null>(null);

  useEffect(() => {
    setLocalHashtags(state.fixedHashtags || '');
  }, [state.fixedHashtags]);

  const { draggedProductIdx, dragOverIdx, handlers: dndHandlers } = useProductDnD(setState);

  const selectedProduct = state.products.find((p) => p.id === state.selectedProductId);

  const modelInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const descriptionImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target !== document.body) {
        if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button' || target.closest('button')) {
          if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            try {
              window.navigator.vibrate(10);
            } catch (err) {
              // ignore
            }
          }
          break;
        }
        target = target.parentElement;
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => document.removeEventListener('touchstart', handleTouchStart);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in a text area or input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // If typing in input, we only allow Ctrl+Z if it's the specific behavior we want, 
      // but usually standard browser behavior handles it for single fields.
      // For global undo (like deleting a product), we want to capture it.
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (!isInput && canUndo) {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        if (!isInput && canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  useEffect(() => {
    const sections = [
      'tiktok-script', 
      'tiktok-caption', 
      'video-prompts', 
      'scene-prompt-1',
      'scene-prompt-2',
      'scene-prompt-3',
      'image-prompt'
    ];
    const observers: IntersectionObserver[] = [];

    const observer = new IntersectionObserver((entries) => {
      // Pick the entry that is mostly visible
      let bestEntry = null;
      let maxRatio = 0;

      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          bestEntry = entry;
        }
      });

      if (bestEntry) {
        setActiveSection((bestEntry as IntersectionObserverEntry).target.id);
      }
    }, { 
      threshold: [0.1, 0.3, 0.5, 0.7, 0.9],
      rootMargin: '-10% 0px -10% 0px' 
    });

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [state.selectedProductId, state.products]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const files = Array.from(e.target.files as FileList);
        const newModels = await Promise.all(
          files.map(async (file: File) => await resizeImage(file, 800, 800, 0.6))
        );
        setState((s) => ({ ...s, modelImages: [...s.modelImages, ...newModels] }), true);
        showToast(`Đã tải ${newModels.length} ảnh người mẫu`);
      } catch (err) {
        showToast("Có lỗi khi xử lý ảnh", "error");
      }
    }
  };

  const handleProductsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const files = Array.from(e.target.files);
        const newProducts = await Promise.all(
          files.map(async (file: File) => {
            const resized = await resizeImage(file, 800, 800, 0.6);
            const id = typeof crypto.randomUUID === 'function' 
              ? crypto.randomUUID() 
              : Math.random().toString(36).substring(2) + Date.now().toString(36);
            return {
              id,
              image: resized,
              status: 'idle',
            } as ProductItem;
          })
        );

        setState((s) => ({
          ...s, 
          products: [...s.products, ...newProducts],
          selectedProductId: s.selectedProductId || newProducts[0]?.id || null
        }), true);
        showToast(`Đã thêm ${newProducts.length} sản phẩm`);
      } catch (err) {
         showToast("Bộ nhớ không đủ hoặc lỗi xử lý", "error");
      }
    }
    if (productInputRef.current) productInputRef.current.value = "";
  };

  const confirmAction = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const removeProduct = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    confirmAction("Bạn có chắc chắn muốn xóa sản phẩm này?", () => {
      setState((s) => ({
        ...s,
        products: s.products.filter((p) => p.id !== id),
        selectedProductId: s.selectedProductId === id ? null : s.selectedProductId
      }), true);
      showToast("Đã xóa sản phẩm");
    });
  };

  const removeAllProducts = () => {
    confirmAction("Bạn có chắc chắn muốn xóa tất cả sản phẩm?", () => {
      setState((s) => ({ ...s, products: [], selectedProductId: null }), true);
    });
  };

  const removeModelImage = (index: number) => {
    confirmAction("Xóa ảnh người mẫu này?", () => {
      setState((s) => ({ ...s, modelImages: s.modelImages.filter((_, i) => i !== index) }), true);
    });
  };

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

  const handleDescriptionImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const resized = await resizeImage(e.target.files[0], 800, 800, 0.6);
        setState(s => ({
          ...s,
          products: s.products.map(p => p.id === id ? { ...p, descriptionImage: resized } : p)
        }), true);
        showToast("Đã tải ảnh mô tả");
      } catch (err) {
        showToast("Lỗi khi xử lý ảnh", "error");
      }
    }
  };

  const handleProductModelImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const resized = await resizeImage(e.target.files[0], 800, 800, 0.6);
        setState(s => ({
          ...s,
          modelImages: s.modelImages.includes(resized) ? s.modelImages : [resized, ...s.modelImages],
          products: s.products.map(p => p.id === id ? { ...p, modelImage: resized } : p)
        }), true);
        showToast("Đã tải ảnh người mẫu cho sản phẩm này");
      } catch (err) {
        showToast("Lỗi khi xử lý ảnh", "error");
      }
    }
  };

  const handleProductCombinedImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const resized = await resizeImage(e.target.files[0], 800, 800, 0.6);
        setState(s => ({
          ...s,
          products: s.products.map(p => p.id === id ? { ...p, combinedImage: resized } : p)
        }), true);
        showToast("Đã tải ảnh ghép thành công");
      } catch (err) {
        showToast("Lỗi khi xử lý ảnh", "error");
      }
    }
  };

  const removeProductModelImage = (id: string) => {
    setState(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? { ...p, modelImage: undefined } : p)
    }), true);
  };

  const removeProductCombinedImage = (id: string) => {
    setState(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? { ...p, combinedImage: undefined } : p)
    }), true);
  };

  const removeDescriptionImage = (id: string) => {
    setState(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? { ...p, descriptionImage: undefined } : p)
    }), true);
  };

  const handleSuggestDescription = async (id: string) => {
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    
    setIsSuggestingDesc(true);
    setSuggestionResult(null);
    try {
      const result = await suggestDescriptionImprovements(
        product.description || '', 
        product.image, 
        product.result?.analysis, 
        product.userReviews
      );
      setSuggestionResult(result);
      // Auto-update if looks significantly better? No, let user confirm in UI
      showToast("Đã tạo gợi ý mô tả mới");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi khi gợi ý mô tả", "error");
    } finally {
      setIsSuggestingDesc(false);
    }
  };

  const processItems = async (idsToExpand: string[]) => {
    if (state.modelImages.length === 0) {
      alert("Vui lòng tải lên ít nhất một Ảnh Mẫu trước khi chạy AI!");
      return;
    }
    
    setIsProcessingAll(true);
    try {
      const modelsCount = state.modelImages.length;
      
      const expandedTasks: { id: string, modelImage: string, image: string, description?: string, descriptionImage?: string, userReviews?: string }[] = [];
      const updatedProductsList = [...state.products];
      
      idsToExpand.forEach(id => {
        const item = state.products.find(p => p.id === id);
        if (!item) return;

        if (!item.modelImage) {
          // First model - update existing item
          const itemIdx = updatedProductsList.findIndex(p => p.id === id);
          if (itemIdx > -1) {
            const firstModel = state.modelImages[0];
            updatedProductsList[itemIdx] = { 
              ...updatedProductsList[itemIdx], 
              modelImage: firstModel, 
              status: 'processing_phase1', 
              error: undefined 
            };
            expandedTasks.push({
              id: updatedProductsList[itemIdx].id,
              modelImage: firstModel,
              image: updatedProductsList[itemIdx].image,
              description: updatedProductsList[itemIdx].description,
              descriptionImage: updatedProductsList[itemIdx].descriptionImage,
              userReviews: updatedProductsList[itemIdx].userReviews
            });
          }
          
          // Additional models - create new items
          for (let i = 1; i < modelsCount; i++) {
            const newId = typeof crypto.randomUUID === 'function' 
              ? crypto.randomUUID() 
              : Math.random().toString(36).substring(2) + Date.now().toString(36);
            const modelImg = state.modelImages[i];
            const newItem: ProductItem = {
              ...item,
              id: newId,
              modelImage: modelImg,
              status: 'processing_phase1',
              error: undefined
            };
            updatedProductsList.push(newItem);
            expandedTasks.push({
              id: newId,
              modelImage: modelImg,
              image: newItem.image,
              description: newItem.description,
              descriptionImage: newItem.descriptionImage,
              userReviews: newItem.userReviews
            });
          }
        } else {
          // Item already has a model, just prepare for processing
          const itemIdx = updatedProductsList.findIndex(p => p.id === id);
          if (itemIdx > -1) {
            updatedProductsList[itemIdx] = { ...updatedProductsList[itemIdx], status: 'processing_phase1', error: undefined };
            expandedTasks.push({
              id: updatedProductsList[itemIdx].id,
              modelImage: updatedProductsList[itemIdx].modelImage!,
              image: updatedProductsList[itemIdx].image,
              description: updatedProductsList[itemIdx].description,
              descriptionImage: updatedProductsList[itemIdx].descriptionImage,
              userReviews: updatedProductsList[itemIdx].userReviews
            });
          }
        }
      });

      // Update state once with all expanded products
      setState(s => ({ ...s, products: updatedProductsList }));

      if (expandedTasks.length > 1) {
        setBatchProgress({ current: 0, total: expandedTasks.length });
      }
      
      // 2. Parallel processing with controlled concurrency
      const MAX_CONCURRENCY = 2;
      let completed = 0;
      
      const runTask = async (task: typeof expandedTasks[0]) => {
        let retryCount = 0;
        const maxRetries = 1; // Giảm retries từ 2 xuống 1
        let success = false;
        const TASK_TIMEOUT = 45000; // Giảm timeout từ 90s xuống 45s

        while (retryCount <= maxRetries && !success) {
          let timeoutId: NodeJS.Timeout | undefined;
          try {
            // Race between API call and timeout
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error("Yêu cầu quá thời gian (Timeout) (Vui lòng thử mô tả hình ảnh dễ hiểu hơn)")), TASK_TIMEOUT);
            });
            
            const result = await Promise.race([
               generatePhase1(task.modelImage, task.image, task.description, task.descriptionImage, task.userReviews),
               timeoutPromise
            ]) as ProductResult;
            
            if (timeoutId) clearTimeout(timeoutId);

            setState((s) => ({
              ...s,
              products: s.products.map((p) => {
                if (p.id === task.id) {
                  const currentResultState = p.result ? { ...p.result } : undefined;
                  const newHistoryItem = currentResultState ? {
                    id: Math.random().toString(36).substring(2),
                    timestamp: Date.now(),
                    result: currentResultState,
                    actionType: 'phase1'
                  } : null;
                  return {
                    ...p,
                    status: 'ready_for_combined',
                    result,
                    history: newHistoryItem ? [...(p.history || []), newHistoryItem].slice(-10) : p.history
                  };
                }
                return p;
              })
            }));
            success = true;
          } catch (e: unknown) {
            if (timeoutId) clearTimeout(timeoutId);
            const errorMsg = e instanceof Error ? e.message : 'Lỗi không xác định';
            const isFatal = ["Quá tải", "Quota", "Safety", "an toàn"].some(keyword => errorMsg.includes(keyword));
            
            if (isFatal) {
                setState((s) => ({
                    ...s,
                    products: s.products.map((p) => p.id === task.id ? { ...p, status: 'error', error: errorMsg } : p),
                }));
                break; // Thoát vòng lặp ngay lập tức
            }

            retryCount++;
            if (retryCount > maxRetries) {
              setState((s) => ({
                ...s,
                products: s.products.map((p) => p.id === task.id ? { ...p, status: 'error', error: errorMsg } : p),
              }));
            } else {
              // Exponential backoff for retries
              await new Promise(resolve => setTimeout(resolve, 3000 * retryCount));
            }
          }
        }
        completed++;
        setBatchProgress(prev => prev ? { ...prev, current: completed } : null);
      };

      const executing = new Set<Promise<void>>();
      for (const task of expandedTasks) {
        const p = runTask(task).finally(() => {
          executing.delete(p);
        });
        executing.add(p);
        if (executing.size >= MAX_CONCURRENCY) {
          await Promise.race(executing);
        }
      }

      await Promise.all(executing);
    } catch (err) {
      console.error("Batch processing error:", err);
      showToast("Có lỗi hệ thống khi xử lý hàng loạt", "error");
    } finally {
      setIsProcessingAll(false);
      setTimeout(() => setBatchProgress(null), 1500);
    }
  };

  const processPhase2 = async (id: string) => {
    const prod = state.products.find(p => p.id === id);
    if (!prod || !prod.combinedImage || !prod.result) return;

    setState(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? { ...p, status: 'processing_phase2', error: undefined } : p)
    }));

    try {
      const result = await generatePhase2(prod.combinedImage, prod.result.analysis, prod.description, state.fixedHashtags);
      
      // Failsafe: ensure hashtags are accent-free and lowercase
      if (result.tiktokCaption) {
        result.tiktokCaption = result.tiktokCaption.split(' ').map(word => {
          if (word.startsWith('#')) {
            return removeVietnameseTones(word).toLowerCase();
          }
          return word;
        }).join(' ');
      }

      setState(s => ({
        ...s,
        products: s.products.map(p => {
          if (p.id === id) {
            const currentResultState = p.result ? { ...p.result } : undefined;
            const newHistoryItem = currentResultState && currentResultState.tiktokScript ? {
              id: Math.random().toString(36).substring(2),
              timestamp: Date.now(),
              result: currentResultState,
              actionType: 'phase2'
            } : null;
            
            return {
              ...p,
              status: 'done',
              result: { ...p.result!, ...result },
              history: newHistoryItem ? [...(p.history || []), newHistoryItem].slice(-10) : p.history
            };
          }
          return p;
        })
      }));
      showToast('Đã xử lý xong The Anchor!', 'success');
    } catch (e: unknown) {
       const errorMsg = e instanceof Error ? e.message : 'Lỗi không xác định';
       setState(s => ({
        ...s,
        products: s.products.map(p => p.id === id ? { ...p, status: 'error', error: errorMsg } : p)
      }));
      showToast(errorMsg, 'error');
    }
  };

  const handleRegenerateScripts = async (id: string) => {
    const prod = state.products.find(p => p.id === id);
    if (!prod || !prod.combinedImage || !prod.result) return;

    setRegeneratingState(s => ({...s, [id]: { ...s[id], script: true }}));
    try {
      const result = await regenerateScripts(prod.combinedImage, prod.result.analysis, prod.description);
      setState(s => ({
        ...s,
        products: s.products.map(p => {
          if (p.id === id) {
            const currentResultState = p.result ? { ...p.result } : undefined;
            const newHistoryItem = currentResultState ? {
              id: Math.random().toString(36).substring(2),
              timestamp: Date.now(),
              result: currentResultState,
              actionType: 'regenerate_script'
            } : null;
            
            return {
              ...p,
              result: { ...p.result!, tiktokScript: result.tiktokScript, abScripts: result.abScripts },
              history: newHistoryItem ? [...(p.history || []), newHistoryItem].slice(-10) : p.history
            };
          }
          return p;
        })
      }));
      showToast('Đã tạo lại Kịch bản!', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi tạo kịch bản', 'error');
    } finally {
      setRegeneratingState(s => ({...s, [id]: { ...s[id], script: false }}));
    }
  };

  const handleRegenerateCaption = async (id: string) => {
    const prod = state.products.find(p => p.id === id);
    if (!prod || !prod.combinedImage || !prod.result) return;

    setRegeneratingState(s => ({...s, [id]: { ...s[id], caption: true }}));
    try {
      const result = await regenerateCaption(prod.combinedImage, prod.result.analysis, prod.description, state.fixedHashtags);
      if (result.tiktokCaption) {
        result.tiktokCaption = result.tiktokCaption.split(' ').map((word: string) => {
          if (word.startsWith('#')) {
            return removeVietnameseTones(word).toLowerCase();
          }
          return word;
        }).join(' ');
      }
      setState(s => ({
        ...s,
        products: s.products.map(p => {
          if (p.id === id) {
            const currentResultState = p.result ? { ...p.result } : undefined;
            const newHistoryItem = currentResultState ? {
              id: Math.random().toString(36).substring(2),
              timestamp: Date.now(),
              result: currentResultState,
              actionType: 'regenerate_caption'
            } : null;
            
            return {
              ...p,
              result: { ...p.result!, tiktokCaption: result.tiktokCaption },
              history: newHistoryItem ? [...(p.history || []), newHistoryItem].slice(-10) : p.history
            };
          }
          return p;
        })
      }));
      showToast('Đã tạo lại Caption!', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi tạo Caption', 'error');
    } finally {
      setRegeneratingState(s => ({...s, [id]: { ...s[id], caption: false }}));
    }
  };

  const handleRegenerateStoryboard = async (id: string) => {
    const prod = state.products.find(p => p.id === id);
    if (!prod || !prod.combinedImage || !prod.result) return;

    setRegeneratingState(s => ({...s, [id]: { ...s[id], storyboard: true }}));
    try {
      const result = await regenerateStoryboard(prod.combinedImage, prod.result.analysis, prod.description);
      setState(s => ({
        ...s,
        products: s.products.map(p => {
          if (p.id === id) {
            const currentResultState = p.result ? { ...p.result } : undefined;
            const newHistoryItem = currentResultState ? {
              id: Math.random().toString(36).substring(2),
              timestamp: Date.now(),
              result: currentResultState,
              actionType: 'regenerate_storyboard'
            } : null;
            
            return {
              ...p,
              result: { ...p.result!, storyboard: result.storyboard },
              history: newHistoryItem ? [...(p.history || []), newHistoryItem].slice(-10) : p.history
            };
          }
          return p;
        })
      }));
      showToast('Đã tạo lại Storyboard!', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi tạo Storyboard', 'error');
    } finally {
      setRegeneratingState(s => ({...s, [id]: { ...s[id], storyboard: false }}));
    }
  };

  const handleReorderStoryboard = (id: string, newStoryboard: StoryboardShot[]) => {
    setState(s => ({
      ...s,
      products: s.products.map(p => p.id === id ? {
        ...p,
        result: {
          ...p.result!,
          storyboard: newStoryboard
        }
      } : p)
    }), true); // Record history on reorder? Sure, why not, or maybe false
  };

  const handleRestoreHistory = (productId: string, historyId: string) => {
    setState(s => ({
      ...s,
      products: s.products.map(p => {
        if (p.id === productId && p.history) {
          const historyItem = p.history.find(h => h.id === historyId);
          if (historyItem) {
            const currentResultState = p.result ? { ...p.result } : undefined;
            const newHistoryItem = currentResultState ? {
              id: Math.random().toString(36).substring(2),
              timestamp: Date.now(),
              result: currentResultState,
              actionType: 'restore_history'
            } : null;
            return {
              ...p,
              result: historyItem.result,
              history: newHistoryItem ? [...p.history, newHistoryItem].slice(-10) : p.history
            };
          }
        }
        return p;
      })
    }), true);
    showToast("Đã khôi phục phiên bản trước");
  };

  const handleCombinedImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const resized = await resizeImage(e.target.files[0], 800, 800, 0.6);
        setState(s => ({
          ...s,
          products: s.products.map(p => p.id === id ? { ...p, combinedImage: resized } : p)
        }), true);
        showToast("Đã tải ảnh đã ghép");
      } catch (err) {
        showToast("Lỗi khi xử lý ảnh", "error");
      }
    }
  };

  const startProcessingAll = () => {
    const pendingIds = state.products.filter(p => p.status === 'idle' || p.status === 'error').map(p => p.id);
    if (pendingIds.length > 0) processItems(pendingIds);
  };

  const handleCopy = (text: string, label: string = "Nội dung") => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          setCopiedText(text);
          showToast(`Đã sao chép ${label.toLowerCase()}`);
          setTimeout(() => setCopiedText(null), 2000);
        }).catch(() => {
           fallbackCopyTextToClipboard(text, label);
        });
      } else {
        fallbackCopyTextToClipboard(text, label);
      }
    } catch (err) {
      fallbackCopyTextToClipboard(text, label);
    }
  };

  const fallbackCopyTextToClipboard = (text: string, label: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      if (document.execCommand("copy")) {
        setCopiedText(text);
        showToast(`Đã sao chép ${label.toLowerCase()}`);
        setTimeout(() => setCopiedText(null), 2000);
      }
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
    document.body.removeChild(textArea);
  };

  const pendingCount = state.products.filter((p) => p.status === 'idle' || p.status === 'error').length;
  const isReadyToProcess = state.modelImages.length > 0 && pendingCount > 0;
  
  const totalProducts = state.products.length;
  const successfulCount = state.products.filter(p => p.status === 'done').length;
  const errorCount = state.products.filter(p => p.status === 'error').length;
  const processingCount = state.products.filter(p => p.status.includes('processing') || p.status === 'ready_for_combined').length;

  const getStatusTitle = (p: ProductItem) => {
    if (p.status === 'done') return 'Hoàn tất - Kịch bản đã sẵn sàng';
    if (p.status === 'error') return `Lỗi: ${p.error || 'Đã có lỗi xảy ra'}`;
    if (p.status === 'ready_for_combined') return 'Chờ ghép ảnh với người mẫu';
    if (p.status.includes('processing')) return 'Đang xử lý nội dung AI...';
    return 'Chờ xử lý';
  };

  return (
    <div className="flex sm:items-center sm:justify-center min-h-[100dvh] max-h-[100dvh] bg-[#030303] text-slate-100 font-sans sm:p-4 mesh-gradient relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow font-display"></div>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={clsx(
              "fixed left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl transition-all",
              toast.type === 'success' ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-100" : "bg-red-500/20 border-red-500/40 text-red-100"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="size-5 text-emerald-400" /> : <AlertCircle className="size-5 text-red-400" />}
            <span className="text-sm font-bold tracking-tight">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full h-[100dvh] max-h-[100dvh] sm:max-w-[420px] lg:max-w-[1200px] sm:h-[780px] lg:h-[850px] bg-black/40 backdrop-blur-3xl sm:rounded-[40px] sm:border border-white/10 shadow-2xl relative flex flex-col lg:flex-row sm:overflow-hidden group/container">
        
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
          )}
        </AnimatePresence>

        {/* Sidebar for Desktop & Mobile Drawer */}
        <Sidebar 
          state={state}
          setState={setState}
          productInputRef={productInputRef}
          removeAllProducts={removeAllProducts}
          removeProduct={removeProduct}
          draggedProductIdx={draggedProductIdx}
          dragOverIdx={dragOverIdx}
          dndHandlers={dndHandlers}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Container */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative h-[100dvh]">
          {/* PERSISTENT RIGHT SIDEBAR (DOCK) for Desktop Results - Removed as it overlaps with new sidebar in ProductDetail */}
          <AnimatePresence>
            {false && selectedProduct && selectedProduct.status === 'done' && (
               <motion.div 
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 20 }}
                 className="hidden lg:flex fixed right-0 sm:absolute top-0 bottom-0 w-16 flex flex-col items-center py-10 gap-3 bg-white/[0.02] border-l border-white/5 backdrop-blur-xl z-[40]"
               >
                  <div className="mb-4">
                    <div className="size-1 w-1 bg-indigo-500 rounded-full animate-pulse mx-auto mb-1"></div>
                    <div className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter text-center scale-75">Nav</div>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => scrollToSection('tiktok-script')} 
                      className={clsx(
                        "p-3 rounded-xl transition-all duration-300 active:scale-90 relative z-10",
                        activeSection === 'tiktok-script' 
                          ? "text-blue-400 bg-blue-500/10 border border-blue-500/30" 
                          : "text-slate-500 hover:text-white hover:bg-white/5"
                      )}
                      title="Kịch bản"
                    >
                       <FileText size={18} />
                    </button>
                    {activeSection === 'tiktok-script' && (
                      <motion.div 
                        layoutId="active-glow-side" 
                        className="absolute inset-0 bg-blue-500/10 blur-md rounded-xl z-0" 
                      />
                    )}
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => scrollToSection('tiktok-caption')} 
                      className={clsx(
                        "p-3 rounded-xl transition-all duration-300 active:scale-90 relative z-10",
                        activeSection === 'tiktok-caption' 
                          ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/30" 
                          : "text-slate-500 hover:text-white hover:bg-white/5"
                      )}
                      title="Caption & Hashtag"
                    >
                       <MessageSquare size={18} />
                    </button>
                    {activeSection === 'tiktok-caption' && (
                      <motion.div 
                        layoutId="active-glow-side" 
                        className="absolute inset-0 bg-indigo-500/10 blur-md rounded-xl z-0" 
                      />
                    )}
                  </div>
                  
                  <div className="w-8 h-px bg-white/5 my-2"></div>
                  
                  <div className="flex flex-col gap-2 items-center">
                    <div className="relative">
                      <button 
                        onClick={() => scrollToSection('video-prompts')} 
                        className={clsx(
                          "p-3 rounded-xl transition-all duration-300 active:scale-90 relative z-10",
                          activeSection === 'video-prompts' 
                            ? "text-purple-400 bg-purple-500/10 border border-purple-500/30" 
                            : "text-slate-500 hover:text-white hover:bg-white/5"
                        )}
                        title="Prompt Video"
                      >
                        <Video size={18} />
                      </button>
                      {activeSection === 'video-prompts' && (
                        <motion.div 
                          layoutId="active-glow-side" 
                          className="absolute inset-0 bg-purple-500/10 blur-md rounded-xl z-0" 
                        />
                      )}
                    </div>
                  </div>

                  <div className="w-8 h-px bg-white/5 my-2"></div>
                  
                  <div className="relative">
                    <button 
                      onClick={() => scrollToSection('image-prompt')} 
                      className={clsx(
                        "p-3 rounded-xl transition-all duration-300 active:scale-90 relative z-10",
                        activeSection === 'image-prompt' 
                          ? "text-pink-400 bg-pink-500/10 border border-pink-500/30" 
                          : "text-slate-500 hover:text-white hover:bg-white/5"
                      )}
                      title="Prompt Hình ảnh"
                    >
                       <ImageIcon size={18} />
                    </button>
                    {activeSection === 'image-prompt' && (
                      <motion.div 
                        layoutId="active-glow-side" 
                        className="absolute inset-0 bg-pink-500/10 blur-md rounded-xl z-0" 
                      />
                    )}
                  </div>

                  <div className="flex-1"></div>

                  <button 
                    onClick={() => scrollToSection('top')} 
                    className="p-3 text-slate-600 hover:text-white transition-colors"
                    title="Về đầu trang"
                  >
                    <ChevronRight size={20} className="-rotate-90" />
                  </button>
               </motion.div>
            )}
          </AnimatePresence>

          {/* MAIN CONTENT */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden pt-0 pb-24 scroll-smooth relative min-h-0" 
            style={{ WebkitOverflowScrolling: 'touch' }}
            onScroll={handleMainContentScroll}
          >
            {/* STICKY TOP WRAPPER */}
            <div className={`sticky top-0 z-40 flex flex-col transition-transform duration-300 ease-in-out w-full bg-[#0f0f13]/95 backdrop-blur-md border-b border-white/[0.03] shadow-md ${isHeaderVisible ? 'translate-y-0' : '-translate-y-[calc(100%+10px)]'}`}>
              
              {/* Status Bar Simulation */}
              <div className="flex-none hidden sm:flex justify-between items-center px-8 pt-6 pb-2 text-[10px] font-bold opacity-60">
                <span>9:41</span>
                <div className="flex gap-1.5">
                  <div className="w-4 h-2.5 border border-white/40 rounded-sm"></div>
                  <div className="w-3 h-3 bg-white/60 rounded-full"></div>
                </div>
              </div>

              {/* HEADER */}
              <div className="flex-none px-4 sm:px-8 py-3 sm:py-6 flex justify-between items-center relative gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                   <button 
                     onClick={() => setIsSidebarOpen(true)}
                     className="lg:hidden size-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-all text-slate-400"
                   >
                     <List size={20} />
                   </button>
                   <div className="min-w-0 pr-2">
                     <h1 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.3em] text-indigo-400/80 font-display mb-0.5 sm:mb-1 truncate leading-none">Tự động hóa TikTok AI</h1>
                     <p className="text-sm sm:text-xl font-display font-bold text-gradient flex items-center gap-2 truncate leading-none">Phòng Lab Sáng Tạo</p>
                   </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                  <div className="flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/5 border border-white/10 rounded-2xl gap-0.5 sm:gap-1">
                    <button 
                      onClick={undo}
                      disabled={!canUndo}
                      className="p-1.5 sm:p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
                      title="Hoàn tác (Ctrl+Z)"
                    >
                      <Undo2 className="size-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <div className="w-px h-3 sm:h-4 bg-white/10 mx-0.5 sm:mx-1"></div>
                    <button 
                      onClick={redo}
                      disabled={!canRedo}
                      className="p-1.5 sm:p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
                      title="Làm lại (Ctrl+Y)"
                    >
                      <Redo2 className="size-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                  {(!user || user.isAnonymous) && (
                    <button
                      onClick={login}
                      className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 sm:h-11 rounded-lg sm:rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 hover:bg-indigo-500 hover:text-white transition-all text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                    >
                      <User size={14} className="sm:hidden" />
                      <User size={16} className="hidden sm:block" />
                      <span className="hidden sm:inline">Đăng nhập</span>
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      confirmAction("Làm mới tất cả ứng dụng?", clearStorage);
                    }}
                    disabled={isProcessingAll}
                    className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg hover:bg-white/10 transition-all active:scale-90 disabled:opacity-30 group"
                  >
                    <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  </button>
                </div>
              </div>

              {/* BATCH PROGRESS UI */}
              <AnimatePresence>
                {batchProgress && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex-none px-4 sm:px-6 pb-2 relative"
                  >
                    <div className="bg-indigo-950/60 border border-indigo-500/30 rounded-2xl overflow-hidden p-3.5 relative shadow-xl shadow-indigo-500/10 backdrop-blur-sm">
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase flex items-center gap-1.5"><Sparkles className="size-3 animate-pulse" /> Đang chạy xử lý hàng loạt</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-indigo-300/80">{batchProgress.current}/{batchProgress.total} items</span>
                          <span className="text-[10px] font-black text-indigo-200 bg-indigo-500/20 px-2 py-0.5 rounded-full">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden relative">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 relative overflow-hidden"
                          transition={{ ease: "easeInOut", duration: 0.3 }}
                        >
                          {batchProgress.current === batchProgress.total && (
                            <motion.div
                              className="absolute inset-0 w-full h-full bg-white/40"
                              initial={{ x: '-100%' }}
                              animate={{ x: '100%' }}
                              transition={{ duration: 0.6, ease: "easeInOut" }}
                            />
                          )}
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          
            <div className="pt-4 px-0">
          
          <AnimatePresence mode="wait">
            {!selectedProduct ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-5 flex flex-col gap-5 pt-2 min-h-full"
              >
                {/* HERO TEXT */}
                <div className="space-y-1.5">
                   <h2 className="text-2xl font-display font-bold text-gradient">Bảng điều khiển Sáng tạo</h2>
                   <p className="text-[13px] text-slate-400 leading-relaxed font-medium">
                     Tải lên ảnh người mẫu và sản phẩm để tự động tạo kịch bản TikTok và gợi ý video.
                   </p>
                </div>

                {/* DASHBOARD OVERVIEW */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 hover:border-indigo-500/30 transition-all duration-300 hover:shadow-[0_4px_20px_rgba(99,102,241,0.05)] hover:-translate-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/20 rounded-md">
                      <LayoutGrid className="size-4 text-indigo-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Tổng quan Hệ thống</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-black/20 rounded-xl p-3 border border-white/5 flex flex-col justify-between hover:-translate-y-1 hover:border-white/20 transition-all cursor-default">
                       <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Tổng sản phẩm</span>
                       <span className="text-2xl font-bold text-white">{totalProducts}</span>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 flex flex-col justify-between hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-emerald-500/20 transition-all cursor-default shadow-sm hover:shadow-emerald-500/10">
                       <span className="text-[10px] uppercase tracking-wider text-emerald-500/80 font-bold mb-1">Thành công</span>
                       <span className="text-2xl font-bold text-emerald-400">{successfulCount}</span>
                    </div>
                     <div className="bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20 flex flex-col justify-between hover:-translate-y-1 hover:border-indigo-400/40 hover:bg-indigo-500/20 transition-all cursor-default shadow-sm hover:shadow-indigo-500/10">
                       <span className="text-[10px] uppercase tracking-wider text-indigo-400/80 font-bold mb-1">Đang xử lý</span>
                       <span className="text-2xl font-bold text-indigo-400">{processingCount}</span>
                    </div>
                    <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20 flex flex-col justify-between hover:-translate-y-1 hover:border-red-400/40 hover:bg-red-500/20 transition-all cursor-default shadow-sm hover:shadow-red-500/10">
                       <span className="text-[10px] uppercase tracking-wider text-red-400/80 font-bold mb-1">Lỗi</span>
                       <span className="text-2xl font-bold text-red-400">{errorCount}</span>
                    </div>
                  </div>
                  
                  {totalProducts > 0 && (
                     <div className="space-y-1.5">
                       <div className="flex justify-between text-[10px] font-bold text-slate-400">
                         <span>Tiến độ tổng thể</span>
                         <span>{Math.round((successfulCount / totalProducts) * 100)}%</span>
                       </div>
                       <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden flex">
                         <div style={{ width: `${(successfulCount / totalProducts) * 100}%` }} className="bg-emerald-400 h-full transition-all duration-500" />
                         <div style={{ width: `${(processingCount / totalProducts) * 100}%` }} className="bg-indigo-500 animate-pulse h-full transition-all duration-500" />
                         <div style={{ width: `${(errorCount / totalProducts) * 100}%` }} className="bg-red-500 h-full transition-all duration-500" />
                       </div>
                     </div>
                  )}
                </div>

                <div className="lg:grid lg:grid-cols-2 lg:gap-6 items-start mt-6">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 relative overflow-hidden h-full hover:border-indigo-500/30 transition-all duration-300 hover:shadow-[0_4px_20px_rgba(99,102,241,0.05)] hover:-translate-y-0.5 group/hashcard">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-500/20 rounded-md">
                          <Hash className="size-4 text-indigo-400 group-hover/hashcard:scale-110 transition-transform" />
                        </div>
                        <span className="text-xs font-semibold text-slate-300">Hashtags Cố Định (Tự lưu)</span>
                      </div>
                      <button 
                        onClick={() => {
                          setState(s => ({ ...s, fixedHashtags: '#dogiadung #muasamonline #giadungthongminh #xuhuong2026' }));
                          showToast("Đã khôi phục mặc định");
                        }}
                        className="text-[9px] font-bold text-indigo-400/60 hover:text-indigo-400 uppercase tracking-tighter transition-colors"
                      >
                        Khôi phục mặc định
                      </button>
                    </div>
                    <textarea
                      className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600 min-h-[90px] lg:min-h-[120px] resize-none hover:border-white/10"
                      placeholder="#dogiadung #muasamonline..."
                      value={localHashtags}
                      onChange={(e) => setLocalHashtags(e.target.value)}
                      onBlur={() => {
                        if (localHashtags !== state.fixedHashtags) {
                          setState(s => ({ ...s, fixedHashtags: localHashtags }), true);
                        }
                      }}
                    />
                    <div className="flex items-start gap-1.5 px-1 text-left">
                      <AlertCircle className="size-3 text-amber-500/60 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-slate-500 leading-relaxed group-hover/hashcard:text-slate-400 transition-colors">
                        Các hashtag này sẽ luôn đính kèm ở cuối Caption. <span className="text-amber-400/80 font-medium">Không dùng dấu tiếng Việt</span>.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 lg:mt-0 h-full">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      ref={modelInputRef}
                      className="hidden"
                      onChange={handleModelUpload}
                    />
                    <div className="relative group h-full col-span-2 bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Thư viện Người Mẫu ({state.modelImages.length})</span>
                        <button 
                          onClick={() => modelInputRef.current?.click()}
                          className="text-[10px] text-indigo-400 font-bold uppercase hover:text-indigo-300 transition-colors"
                        >
                          + Thêm ảnh
                        </button>
                      </div>
                      
                      <div className="relative w-full">
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar min-h-[90px]">
                          {state.modelImages.map((img, idx) => (
                            <div key={idx} className="relative group shrink-0">
                              <div className="size-20 lg:size-24 rounded-xl bg-black/40 border border-white/10 overflow-hidden">
                                 <img src={img} alt={`Model ${idx}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }} />
                              </div>
                              <button 
                                onClick={() => removeModelImage(idx)} 
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full size-5 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                              >
                                 <X size={10} />
                              </button>
                            </div>
                          ))}
                          
                          {state.modelImages.length === 0 && (
                            <button
                              onClick={() => modelInputRef.current?.click()}
                              className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 transition-all text-slate-500 hover:text-indigo-400 gap-2 group/empty"
                            >
                              <div className="p-2 bg-white/5 rounded-full group-hover/empty:bg-indigo-500/20 transition-colors">
                                 <User className="size-6" />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-tight">Tải ảnh người mẫu để bắt đầu</span>
                            </button>
                          )}
                        </div>
                        <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-[#020202] to-transparent pointer-events-none z-10" />
                      </div>
                    </div>

                    <div className="col-span-2">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          ref={productInputRef}
                          className="hidden"
                          onChange={handleProductsUpload}
                        />
                        <button
                          onClick={() => productInputRef.current?.click()}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center border-dashed hover:bg-white/10 transition-all active:scale-[0.98] active:bg-white/20 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_4px_20px_rgba(168,85,247,0.05)] group"
                        >
                          <div className="flex items-center justify-between w-full mb-3">
                             <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest group-hover:text-purple-300 transition-colors">Thư viện Sản Phẩm ({state.products.length})</span>
                             <span className="text-[10px] text-purple-400 font-bold uppercase">+ Thêm sản phẩm</span>
                          </div>
                          
                          {state.products.length > 0 ? (
                            <div className="flex -space-x-3 group-hover:scale-105 transition-transform py-2">
                              {state.products.slice(0, 6).map((p, i) => (
                                 <div key={p.id} className="size-14 rounded-xl bg-[#0c0c1e] border-2 border-[#1a1a3a] overflow-hidden shadow-lg shadow-black/40">
                                   <img src={p.image} className="w-full h-full object-cover opacity-80" alt="" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/1e1e2d/a5b4fc?text=Loi+Anh"; }} />
                                 </div>
                              ))}
                              {state.products.length > 6 && (
                                 <div className="size-14 rounded-xl bg-indigo-900 border-2 border-[#1a1a3a] flex items-center justify-center text-xs font-bold z-10 shadow-lg">
                                   +{state.products.length - 6}
                                 </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-4 flex flex-col items-center gap-2">
                               <div className="p-2 bg-white/5 rounded-full group-hover:bg-purple-500/20 transition-colors">
                                  <Images className="size-6 text-purple-400" />
                               </div>
                               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Tải ảnh sản phẩm gốc để phân tích</span>
                            </div>
                          )}
                        </button>
                    </div>
                  </div>
                </div>

                {/* PRODUCT LIST & DELETE ALL */}
                  <ProductGrid 
                    state={state}
                    setState={setState}
                    removeProduct={removeProduct}
                    removeAllProducts={removeAllProducts}
                    draggedProductIdx={draggedProductIdx}
                    dragOverIdx={dragOverIdx}
                    dndHandlers={dndHandlers}
                  />

                  {/* START PROCESSING BUTTON */}
                <div className="mt-2">
                  <button
                    onClick={startProcessingAll}
                    disabled={!isReadyToProcess || isProcessingAll}
                    className="w-full bg-white text-[#050510] hover:bg-slate-200 disabled:bg-white/10 disabled:text-white/30 font-bold py-4 rounded-2xl transition-all active:scale-[0.98] active:brightness-110 flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] group"
                  >
                    <div className="flex items-center gap-2 group-hover:scale-[1.02] transition-transform">
                      {isProcessingAll ? (
                        <>
                          <Loader2 className="size-5 animate-spin text-indigo-500" />
                          Đang tạo nội dung AI...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-5" />
                          Tạo prompt ảnh hàng loạt ({pendingCount})
                        </>
                      )}
                    </div>
                  </button>
                </div>

              </motion.div>
            ) : selectedProduct ? (
              <ProductDetail 
                state={state}
                selectedProduct={selectedProduct}
                removeProduct={removeProduct}
                setState={setState}
                handleDescriptionImageUpload={handleDescriptionImageUpload}
                removeDescriptionImage={removeDescriptionImage}
                handleModelImageUpload={handleProductModelImageUpload}
                removeModelImage={removeProductModelImage}
                handleCombinedImageUpload={handleProductCombinedImageUpload}
                removeCombinedImage={removeProductCombinedImage}
                handleSuggestDescription={() => handleSuggestDescription(selectedProduct.id)}
                isSuggestingDesc={isSuggestingDesc}
                suggestionResult={suggestionResult}
                setSuggestionResult={setSuggestionResult}
                regeneratingState={regeneratingState}
                handleRegenerateScripts={handleRegenerateScripts}
                handleRegenerateCaption={handleRegenerateCaption}
                handleRegenerateStoryboard={handleRegenerateStoryboard}
                handleRestoreHistory={handleRestoreHistory}
                processPhase1={() => processItems([selectedProduct.id])}
                processPhase2={processPhase2}
                copiedText={copiedText}
                handleCopy={handleCopy}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
              />
            ) : null}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Thumbnails (The Dock) - Mobile Only */}
      <MobileDock 
        state={state}
        setState={setState}
        productInputRef={productInputRef}
        removeProduct={removeProduct}
        dndHandlers={dndHandlers}
        draggedProductIdx={draggedProductIdx}
        dragOverIdx={dragOverIdx}
        showSidebar={() => setIsSidebarOpen(true)}
        activeSection={activeSection}
        scrollToSection={scrollToSection}
        handleCopy={handleCopy}
      />

      {/* Home Indicator */}
        <div className="hidden sm:block absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-40"></div>

        {/* CUSTOM CONFIRM DIALOG */}
        <AnimatePresence>
          {confirmDialog.isOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                className="bg-[#1a1a3a] border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20 shadow-inner">
                  <AlertCircle className="size-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3 uppercase tracking-widest">Xác Nhận</h3>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed px-2">
                  {confirmDialog.message}
                </p>
                <div className="flex w-full gap-4">
                  <button 
                    onClick={closeConfirm}
                    className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs uppercase tracking-widest transition-all active:scale-95"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={() => {
                      confirmDialog.onConfirm();
                      closeConfirm();
                    }}
                    className="flex-1 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-500/20"
                  >
                    Đồng ý
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
