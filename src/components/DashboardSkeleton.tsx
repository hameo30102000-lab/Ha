import React from 'react';
import { motion } from 'motion/react';

export const DashboardSkeleton = () => {
  return (
    <div className="flex sm:items-center sm:justify-center min-h-screen bg-[#030303] text-slate-100 font-sans sm:p-4 mesh-gradient relative overflow-hidden">
      <div className="w-full h-[100dvh] sm:max-w-[420px] lg:max-w-[1200px] sm:h-[780px] lg:h-[850px] bg-black/40 backdrop-blur-3xl sm:rounded-[40px] sm:border border-white/10 shadow-2xl relative flex flex-col lg:flex-row sm:overflow-hidden animate-pulse">
        
        {/* Sidebar Skeleton */}
        <aside className="hidden lg:flex flex-col w-[320px] border-r border-white/5 bg-white/[0.01] z-30">
          <div className="p-8 border-b border-white/5">
            <div className="h-2 w-20 bg-white/5 rounded-full mb-3"></div>
            <div className="h-6 w-32 bg-white/10 rounded-lg"></div>
          </div>
          <div className="flex-1 p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 w-full bg-white/5 rounded-2xl"></div>
            ))}
          </div>
        </aside>

        {/* Main Content Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          <div className="px-8 py-6 flex justify-between items-center border-b border-white/[0.03]">
            <div className="space-y-2">
              <div className="h-2 w-32 bg-white/5 rounded-full"></div>
              <div className="h-6 w-48 bg-white/10 rounded-lg"></div>
            </div>
            <div className="flex gap-3">
              <div className="size-11 bg-white/5 rounded-2xl"></div>
              <div className="size-11 bg-white/5 rounded-2xl"></div>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-8">
            <div className="space-y-3">
              <div className="h-10 w-2/3 bg-white/10 rounded-xl"></div>
              <div className="h-4 w-1/2 bg-white/5 rounded-lg"></div>
            </div>

            <div className="h-48 w-full bg-white/5 rounded-3xl"></div>

            <div className="grid grid-cols-2 gap-6">
              <div className="h-64 bg-white/5 rounded-3xl"></div>
              <div className="h-64 bg-white/5 rounded-3xl"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
