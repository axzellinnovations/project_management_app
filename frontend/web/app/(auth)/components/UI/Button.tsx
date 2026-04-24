import React from 'react';

// Explicitly defining props ensures TypeScript catches missing or invalid data at compile time.
interface ButtonProps {
  children: React.ReactNode;
  isLoading?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
}

/*
 * A highly reusable, standardized button component.
 * Features built-in loading state management to prevent double-submissions.
 */
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
      // SECURITY & UX: If the API call is in progress (isLoading), disable the button 
      // so the user can't spam the backend with 10 identical POST requests.
      disabled={isLoading || disabled}
      // Dynamic Tailwind classes. If disabled/loading, we drop the opacity and kill the hover effects.
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