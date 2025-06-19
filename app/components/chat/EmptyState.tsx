import React from "react";

export const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-[80vw] text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-[50px] -translate-y-[50px]">
          <div className="w-32 h-16 border-t-2 border-l-2 border-r-2 rounded-t-full border-zinc-500 opacity-10 absolute top-0"></div>
          <div className="w-28 h-14 border-t-2 border-l-2 border-r-2 rounded-t-full border-zinc-500 opacity-20 absolute top-1"></div>
          <div className="w-24 h-12 border-t-2 border-l-2 border-r-2 rounded-t-full border-zinc-500 opacity-30 absolute top-2"></div>
          <div className="w-20 h-10 border-t-2 border-l-2 border-r-2 rounded-t-full border-zinc-500 opacity-40 absolute top-3"></div>
        </div>
        <h2 className="text-2xl font-medium text-zinc-100 mb-3">C R A Y</h2>
        <p className="text-zinc-400 mb-6">Ask anything, get instant answers.</p>
      </div>
    </div>
  );
};
