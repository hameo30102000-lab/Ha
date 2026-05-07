import React, { useState, useEffect } from 'react';
import { AppState } from '../types';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useProductDnD(setState: (updater: (s: AppState) => AppState, shouldRecordHistory?: boolean) => void) {
  const [draggedProductIdx, setDraggedProductIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    setDraggedProductIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedProductIdx !== null && draggedProductIdx !== idx) {
      setState(s => {
        const newProducts = [...s.products];
        const [removed] = newProducts.splice(draggedProductIdx, 1);
        newProducts.splice(idx, 0, removed);
        return { ...s, products: newProducts };
      }, true);
    }
    setDraggedProductIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedProductIdx(null);
    setDragOverIdx(null);
  };

  return {
    draggedProductIdx,
    dragOverIdx,
    handlers: (idx: number) => ({
      draggable: true,
      onDragStart: () => handleDragStart(idx),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, idx),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, idx),
      onDragEnd: handleDragEnd
    })
  };
}
