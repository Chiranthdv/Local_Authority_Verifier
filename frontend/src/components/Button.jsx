import React from 'react';

// Design System Button Component
// Standardizes button styles across the application

const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  as = 'button',
  className = '',
  ...props
}) => {
  // Base styles
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed';

  // Size variants
  const sizeStyles = {
    small: 'px-4 py-2 text-sm rounded-xl',
    medium: 'px-6 py-3 text-base rounded-2xl',
    large: 'px-8 py-4 text-lg rounded-2xl'
  };

  // Variant styles
  const variantStyles = {
    primary: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 focus:ring-cyan-400/50 shadow-lg hover:shadow-xl',
    secondary: 'border border-white/20 text-slate-200 hover:border-white/40 hover:bg-white/5 focus:ring-white/20',
    success: 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 focus:ring-emerald-400/50',
    warning: 'bg-amber-400 text-slate-950 hover:bg-amber-300 focus:ring-amber-400/50',
    danger: 'bg-rose-500 text-white hover:bg-rose-400 focus:ring-rose-500/50'
  };

  const classes = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`.trim();

  const Component = as;

  return (
    <Component
      type={as === 'button' ? type : undefined}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </Component>
  );
};

export default Button;