
import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-cyan-400"></div>
      <p className="text-cyan-300">Đang phân tích phản ứng...</p>
    </div>
  );
};

export default Loader;
