import type { ReactNode } from 'react';

interface PillProps {
  children: ReactNode;
  dotColor?: string;
  className?: string;
}

export function Pill({ children, dotColor, className = '' }: PillProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 text-xs font-semibold',
        'px-[10px] py-1 rounded-full border border-wb-line bg-white',
        className,
      ].join(' ')}
    >
      {dotColor && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
      )}
      {children}
    </span>
  );
}
