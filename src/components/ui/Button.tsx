import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: 'base' | 'sm' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'base',
    isLoading = false,
    icon,
    children,
    className = '',
    fullWidth,
    disabled,
    ...props
}) => {

    // Base styling shared by all buttons
    const baseClasses = `
    inline-flex items-center justify-center gap-2
    rounded-md
    text-sm font-semibold
    transition-all duration-150
    outline-none whitespace-nowrap
    focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    active:scale-[0.98]
  `;

    // Button sizes
    const sizeClasses = {
        base: "px-5 py-2.5",
        sm: "px-3 py-1.5 text-xs",
        lg: "px-8 py-4 text-base",
        icon: "p-2 aspect-square gap-0"
    };

    // Width + disabled state
    const layoutClasses = `
    ${fullWidth ? 'w-full' : ''}
    ${(disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}
  `;

    // Variant styles
    const variantClasses: Record<ButtonVariant, string> = {

        primary: `
      bg-blue-600 text-white
      hover:bg-blue-700
      border border-transparent
      font-semibold
      shadow-sm
    `,

        secondary: `
      bg-gray-100 text-gray-700
      hover:bg-gray-200
      border border-gray-200
      shadow-sm
    `,

        ghost: `
      bg-transparent text-slate-500
      hover:text-blue-600
      border border-transparent
    `,

        danger: `
      bg-red-600 text-white
      hover:bg-red-700
      border border-transparent
      font-semibold
      shadow-sm
    `
    };

    return (
        <button
            className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${layoutClasses}
        ${variantClasses[variant]}
        ${className}
      `}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            aria-disabled={disabled || isLoading}
            {...props}
        >

            {isLoading ? (
                <>
                    <svg
                        className="animate-spin h-4 w-4 text-current"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 
              0 0 5.373 0 12h4zm2 
              5.291A7.962 7.962 
              0 014 12H0c0 3.042 
              1.135 5.824 3 
              7.938l3-2.647z"
                        />
                    </svg>

                    {children || 'Procesando...'}
                </>
            ) : (
                <>
                    {icon && (
                        <span className="flex-shrink-0">
                            {icon}
                        </span>
                    )}

                    {children}
                </>
            )}

        </button>
    );
};