import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  isLoading?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
}

export default function Button({ 
  children, 
  isLoading = false, 
  type = "button", 
  onClick,
  disabled 
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`w-full font-bold py-3.5 min-h-[44px] rounded-xl transition-all text-white shadow-blue-500/30 shadow-lg active:scale-[0.98] mt-4 flex justify-center items-center
        ${isLoading || disabled 
          ? 'bg-blue-400 cursor-not-allowed opacity-70' 
          : 'bg-blue-600 hover:bg-blue-700'
        }`}
    >
      {children}
    </button>
  );
}