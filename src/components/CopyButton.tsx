import React from 'react';
import { Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CopyButton = ({ 
  text, 
  label, 
  copiedText, 
  onCopy, 
  className, 
  iconOnly = false, 
  defaultText = "Sao chép", 
  copiedStateText = "Đã chép" 
}: { 
  text: string, 
  label?: string, 
  copiedText: string | null, 
  onCopy: (t: string, l?: string) => void, 
  className?: string, 
  iconOnly?: boolean, 
  defaultText?: string, 
  copiedStateText?: string 
}) => {
  const isCopied = copiedText === text;
  return (
    <button onClick={() => onCopy(text, label)} className={`flex items-center justify-center gap-1.5 transition-all ${className}`}>
      <div className="relative w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
        <AnimatePresence initial={false}>
          {isCopied ? (
            <motion.div
              key="check"
              initial={{ scale: 0, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check className="size-3.5 text-emerald-400" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, rotate: 90 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Copy className="size-3.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!iconOnly && (
        <span className={isCopied ? "text-emerald-400 whitespace-nowrap transition-colors" : "whitespace-nowrap transition-colors"}>
          {isCopied ? copiedStateText : defaultText}
        </span>
      )}
    </button>
  );
};
