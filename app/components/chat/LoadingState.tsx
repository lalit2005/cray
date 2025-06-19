import React from "react";

export const LoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-zinc-500">
        <div className="animate-spin rounded h-8 w-8 border-t-2 border-zinc-500 mx-auto mb-2" />
        <p>Loading messages...</p>
      </div>
    </div>
  );
};
