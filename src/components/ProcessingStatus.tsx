import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ProcessingStatus({ phase }: { phase: 'phase1' | 'phase2' }) {
    const [step, setStep] = useState(0);

    const steps1 = [
        "Đang phân tích hình ảnh sản phẩm góc độ 1...",
        "Đang trích xuất đặc điểm nổi bật...",
        "Đang mô phỏng thao tác với sản phẩm...",
        "Đang tạo Prompt tái tạo không gian 3D..."
    ];

    const steps2 = [
        "Đang phân tích góc độ tâm lý và insight khách hàng...",
        "Đang biên soạn 3 kịch bản âm thanh viral (A/B Test)...",
        "Đang tối ưu Call To Action...",
        "Đang thiết kế Storyboard góc quay cinematic...",
        "Đang tinh chỉnh 5 hashtag chuẩn SEO TikTok..."
    ];

    const messages = phase === 'phase1' ? steps1 : steps2;

    useEffect(() => {
        const interval = setInterval(() => {
            setStep((s) => (s + 1) % messages.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [messages.length]);

    const isPhase1 = phase === 'phase1';
    const primaryColor = isPhase1 ? 'blue' : 'purple';
    const secondaryColor = isPhase1 ? 'cyan' : 'fuchsia';
    const primaryClass = isPhase1 ? 'text-blue-400' : 'text-purple-400';
    const primaryBorder = isPhase1 ? 'border-blue-500' : 'border-purple-500';
    const secondaryBorder = isPhase1 ? 'border-cyan-500' : 'border-fuchsia-500';
    const bgBlur = isPhase1 ? 'bg-blue-500/20' : 'bg-purple-500/20';
    const bgParticle = isPhase1 ? 'bg-blue-500/30' : 'bg-purple-500/30';
    const gradient = isPhase1 ? 'from-blue-600 to-cyan-500' : 'from-purple-600 to-fuchsia-500';

    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 relative overflow-hidden min-h-[300px]">
            {/* Visual Flair: Floating Particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            y: [0, -100],
                            x: [0, i % 2 === 0 ? 20 : -20],
                            opacity: [0, 0.4, 0],
                            scale: [0.5, 1, 0.5]
                        }}
                        transition={{
                            duration: 3 + i,
                            repeat: Infinity,
                            delay: i * 0.5,
                            ease: "easeInOut"
                        }}
                        className={`absolute bottom-0 size-2 ${bgParticle} rounded-full blur-[2px]`}
                        style={{ left: `${15 + i * 15}%` }}
                    />
                ))}
            </div>

            <div className="relative mb-10">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="relative size-20 flex items-center justify-center"
                >
                    <div className={`absolute inset-0 rounded-full border-t-2 ${primaryBorder} border-r-2 border-transparent`}></div>
                    <div className={`absolute inset-2 rounded-full border-b-2 ${secondaryBorder} border-l-2 border-transparent opacity-50`}></div>
                </motion.div>
                <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`absolute inset-0 ${bgBlur} rounded-full blur-xl`}
                />
                <Sparkles className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-8 ${primaryClass}`} />
            </div>

            <div className="h-16 overflow-hidden flex items-center justify-center text-center relative w-full mb-4">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={step}
                        initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
                        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                        exit={{ y: -20, opacity: 0, filter: "blur(4px)" }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="text-slate-100 font-display font-medium tracking-wide text-xs sm:text-sm leading-relaxed absolute w-full px-2"
                    >
                        {messages[step]}
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* Progress indicator bar */}
            <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative mb-10">
                <motion.div 
                    className={`absolute left-0 top-0 h-full bg-gradient-to-r ${gradient}`}
                    animate={{ left: ["-100%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: "60%" }}
                />
            </div>

            <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-[9px] text-slate-500 uppercase tracking-widest font-black text-center"
            >
                Vui lòng không tắt trình duyệt
            </motion.p>
        </div>
    );
}
