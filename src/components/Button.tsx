import type { ReactNode, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-wb-ink text-white shadow-wb-btn-primary hover:shadow-[5px_5px_0_#F5A524]',
  ghost:   'bg-white text-wb-ink border border-wb-line hover:border-wb-ink',
  accent:  'bg-wb-sunset text-white shadow-wb-btn-accent hover:shadow-[5px_5px_0_#0F1C2E]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-[7px] text-[13px] rounded-lg',
  md: 'px-4 py-[10px] text-sm rounded-[10px]',
  lg: 'px-[22px] py-[14px] text-base rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold font-[Inter]',
        'border border-transparent cursor-pointer select-none',
        'transition-[transform,box-shadow] duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'hover:-translate-y-px',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
