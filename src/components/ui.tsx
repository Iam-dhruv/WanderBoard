import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ title, isOpen, onClose, children, maxWidth = 'max-w-[520px]' }: ModalProps) {
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: 'rgba(15,28,46,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className={[
          'relative w-full rounded-[20px] p-8',
          'border-[1.5px] border-wb-ink',
          maxWidth,
        ].join(' ')}
        style={{
          background: 'var(--wb-paper)',
          boxShadow: 'var(--wb-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white border border-wb-line flex items-center justify-center text-wb-ink font-bold text-lg hover:bg-wb-paper-2 transition-colors"
          aria-label="Close"
        >
          ×
        </button>
        {title && (
          <h2 className="font-fraunces text-[32px] font-bold tracking-tight text-wb-ink mb-4 leading-tight">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
