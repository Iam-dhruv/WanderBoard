import type { ReactNode } from 'react';

type StickerColor = 'default' | 'sun' | 'coral' | 'sky' | 'moss' | 'plum' | 'ocean';
type Rotation = 'left' | 'right' | 'none';

interface StickerProps {
  children: ReactNode;
  color?: StickerColor;
  rotation?: Rotation;
  className?: string;
}

const colorClasses: Record<StickerColor, string> = {
  default: 'bg-white text-wb-ink',
  sun:     'bg-wb-sun text-wb-ink',
  coral:   'bg-wb-coral text-white',
  sky:     'bg-wb-sky text-white',
  moss:    'bg-wb-moss text-white',
  plum:    'bg-wb-plum text-white',
  ocean:   'bg-wb-ocean text-white',
};

const rotationClasses: Record<Rotation, string> = {
  left:  '-rotate-2',
  right: 'rotate-2',
  none:  'rotate-0',
};

export function Sticker({ children, color = 'default', rotation = 'left', className = '' }: StickerProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 text-xs font-bold',
        'px-[10px] py-1 rounded-full whitespace-nowrap select-none',
        'border-[1.5px] border-wb-ink',
        'shadow-[2px_2px_0_#0F1C2E]',
        colorClasses[color],
        rotationClasses[rotation],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
