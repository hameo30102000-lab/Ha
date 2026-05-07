import { useEffect, useState, useRef } from "react";
import { AppState, ProductItem } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore';

const STORAGE_KEY = "tiktok-media-gen-state-v1";

const initialState: AppState = {
  modelImages: [],
  products: [],
  selectedProductId: null,
  viewMode: 'grid',
  fixedHashtags: '#dogiadung #anhminhsongkhoe #giadungthongminh',
};

async function syncStateToFirestore(prevState: AppState, newState: AppState, uid: string) {
  try {
    const workspaceRef = doc(db, 'workspaces', uid);
    
    // Update workspace configs
    if (prevState.viewMode !== newState.viewMode || prevState.fixedHashtags !== newState.fixedHashtags) {
      await updateDoc(workspaceRef, {
        viewMode: newState.viewMode,
        fixedHashtags: newState.fixedHashtags,
        updatedAt: Date.now()
      });
    }

    // Sync products
    const oldPMap = new Map(prevState.products.map(p => [p.id, p]));
    const newPMap = new Map(newState.products.map(p => [p.id, p]));

    for (const newP of newState.products) {
      const oldP = oldPMap.get(newP.id);
      if (!oldP || JSON.stringify(oldP) !== JSON.stringify(newP)) {
        const productToWrite = Object.fromEntries(Object.entries({
          ...newP,
          createdAt: newP.createdAt || Date.now(),
          updatedAt: Date.now()
        }).filter(([_, v]) => v !== undefined));
        await setDoc(doc(db, 'workspaces', uid, 'products', newP.id), productToWrite);
      }
    }

    for (const oldP of prevState.products) {
      if (!newPMap.has(oldP.id)) {
        await deleteDoc(doc(db, 'workspaces', uid, 'products', oldP.id));
      }
    }
    
    // Sync models - simple array sync by recreating documents
    if (JSON.stringify(prevState.modelImages) !== JSON.stringify(newState.modelImages)) {
      const modelsRef = collection(db, 'workspaces', uid, 'models');
      const oldModels = await getDocs(modelsRef);
      // delete all old ones
      for (const m of oldModels.docs) {
        await deleteDoc(m.ref);
      }
      // create new ones
      for (let i = 0; i < newState.modelImages.length; i++) {
        await setDoc(doc(db, 'workspaces', uid, 'models', `model_${i}`), {
          image: newState.modelImages[i],
          createdAt: Date.now()
        });
      }
    }

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${uid}`);
  }
}

export function useAppStorage() {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>(initialState);
  const [history, setHistory] = useState<AppState[]>([]);
  const [future, setFuture] = useState<AppState[]>([]);
  const isLoadedFromFirebase = useRef(false);

  // Initial load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.modelImage && (!parsed.modelImages || parsed.modelImages.length === 0)) {
          parsed.modelImages = [parsed.modelImage];
          delete parsed.modelImage;
        }
        setState(prev => (!isLoadedFromFirebase.current ? { ...prev, ...parsed } : prev));
      }
    } catch (e) {
      console.error("Failed to load state from localStorage", e);
    }
  }, []);

  // Fetch from Firebase when user logs in
  useEffect(() => {
    if (!user) return;
    const fetchCloudData = async () => {
      try {
        const workspaceRef = doc(db, 'workspaces', user.uid);
        const workspaceDoc = await getDoc(workspaceRef);
        
        if (!workspaceDoc.exists()) {
           // Create workspace
           await setDoc(workspaceRef, {
             ownerId: user.uid,
             viewMode: state.viewMode,
             fixedHashtags: state.fixedHashtags,
             createdAt: Date.now(),
             updatedAt: Date.now()
           });
           
           // Optionally create products and models from local state
           for (const newP of state.products) {
              const productToWrite = Object.fromEntries(Object.entries({
                ...newP,
                createdAt: newP.createdAt || Date.now(),
                updatedAt: Date.now()
              }).filter(([_, v]) => v !== undefined));
              await setDoc(doc(db, 'workspaces', user.uid, 'products', newP.id), productToWrite);
           }
           
           for (let i = 0; i < state.modelImages.length; i++) {
             await setDoc(doc(db, 'workspaces', user.uid, 'models', `model_${i}`), {
               image: state.modelImages[i],
               createdAt: Date.now()
             });
           }
           isLoadedFromFirebase.current = true;
        } else {
          const data = workspaceDoc.data();
        try {
          const productsSnap = await getDocs(collection(db, 'workspaces', user.uid, 'products'));
          const modelsSnap = await getDocs(collection(db, 'workspaces', user.uid, 'models'));
          
          const cloudState: AppState = {
            viewMode: data.viewMode || 'grid',
            fixedHashtags: data.fixedHashtags !== undefined ? data.fixedHashtags : '#dogiadung #anhminhsongkhoe #giadungthongminh',
            selectedProductId: state.selectedProductId,
            products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductItem)),
            modelImages: modelsSnap.docs.map(d => d.data().image as string)
          };
          
          isLoadedFromFirebase.current = true;
          setState(cloudState);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `workspaces/${user.uid}/products_or_models`);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `workspaces/${user.uid}_fetchData`);
    }
  };
    fetchCloudData();
  }, [user]);

  // Sync to local storage & Firestore
  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error("Failed to save state to localStorage", e);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [state]);

  const setSyncedState = (updater: AppState | ((s: AppState) => AppState), shouldRecordHistory = false) => {
    setState(prevState => {
      const newState = typeof updater === 'function' ? updater(prevState) : updater;
      
      if (shouldRecordHistory) {
         setHistory(prevHistory => {
            if (prevHistory.length > 0 && prevHistory[prevHistory.length - 1] === prevState) return prevHistory;
            return [...prevHistory, prevState].slice(-15);
         });
         setFuture([]);
      }
      
      if (user) {
        syncStateToFirestore(prevState, newState, user.uid);
      }
      
      return newState;
    });
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setFuture(prev => [state, ...prev].slice(0, 15));
    setHistory(newHistory);
    
    if (user) syncStateToFirestore(state, previous, user.uid);
    setState(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setHistory(prev => [...prev, state].slice(-15));
    setFuture(newFuture);
    
    if (user) syncStateToFirestore(state, next, user.uid);
    setState(next);
  };

  const clearStorage = () => {
    setState(initialState);
    localStorage.removeItem(STORAGE_KEY);
    if (user) syncStateToFirestore(state, initialState, user.uid);
  };

  return { 
    state, 
    setState: setSyncedState, 
    clearStorage,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0
  };
}
