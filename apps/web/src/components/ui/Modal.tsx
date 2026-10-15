import React from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ title, onClose, children, footer, maxWidth = 'max-w-lg' }: ModalProps) {
  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4">
      <div className={`bg-white w-full ${maxWidth} max-h-[92vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-100">
          <h3 className="font-bold text-purple-950 text-base">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center justify-center"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-purple-100 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}
