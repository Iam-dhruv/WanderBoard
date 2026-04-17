import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
	title: string;
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
}

export function Modal({ title, isOpen, onClose, children }: ModalProps) {
	if (!isOpen) {
		return null;
	}

	if (typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6"
			onClick={onClose}
		>
			<div
				className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
					<h3 className="text-lg font-semibold text-gray-900">{title}</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
					>
						Close
					</button>
				</div>
				<div className="px-6 py-5">
					{children}
				</div>
			</div>
		</div>,
		document.body,
	);
}
