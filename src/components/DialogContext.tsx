import { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface DialogState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm' | 'prompt';
    confirmText?: string;
    onConfirm?: () => void;
    onPromptSubmit?: (value: string) => void;
    isSuccess?: boolean;
}

interface DialogContextProps {
    showAlert: (title: string, message: string, isSuccess?: boolean) => void;
    showConfirm: (title: string, message: string, confirmText: string, onConfirm: () => void) => void;
    showPrompt: (title: string, message: string, defaultValue: string, confirmText: string, onSubmit: (val: string) => void) => void;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
    const [dialog, setDialog] = useState<DialogState>({ isOpen: false, title: '', message: '', type: 'alert' });
    const [inputValue, setInputValue] = useState('');

    const showAlert = (title: string, message: string, isSuccess = false) => {
        setDialog({ isOpen: true, title, message, type: 'alert', isSuccess });
    };

    const showConfirm = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
        setDialog({ isOpen: true, title, message, type: 'confirm', confirmText, onConfirm });
    };

    const showPrompt = (title: string, message: string, defaultValue: string, confirmText: string, onSubmit: (val: string) => void) => {
        setInputValue(defaultValue);
        setDialog({ isOpen: true, title, message, type: 'prompt', confirmText, onPromptSubmit: onSubmit });
    };

    const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

    return (
        <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
            {children}
            <AnimatePresence>
                {dialog.isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            onClick={dialog.type === 'alert' ? closeDialog : undefined}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-brand-card rounded-3xl border border-brand-border shadow-2xl p-8"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className={cn("p-3 rounded-full", dialog.type === 'alert' ? (dialog.isSuccess ? "bg-brand-success/10 text-brand-success" : "bg-brand-primary/10 text-brand-primary") : "bg-brand-primary/10 text-brand-primary")}>
                                    {dialog.isSuccess ? <CheckCircle className="w-6 h-6" /> : (dialog.type === 'prompt' ? <Info className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />)}
                                </div>
                                <h3 className="text-xl font-bold text-brand-text">{dialog.title}</h3>
                            </div>
                            <p className="text-brand-muted whitespace-pre-wrap mb-6 leading-relaxed">{dialog.message}</p>

                            {/* Input exclusivo para el modo Prompt */}
                            {dialog.type === 'prompt' && (
                                <input
                                    type="text"
                                    autoFocus
                                    title="Campo de texto"
                                    aria-label="Campo de entrada de texto"
                                    placeholder="Escribe aquí..."
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    className="w-full mb-8 bg-brand-bg border border-brand-border text-brand-text px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                />
                            )}

                            <div className={cn("flex gap-3", dialog.type === 'alert' ? "justify-end" : "justify-between")}>
                                {dialog.type !== 'alert' && (
                                    <button onClick={closeDialog} className="px-6 py-2 text-brand-muted hover:text-brand-text font-bold transition-colors cursor-pointer">
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (dialog.type === 'prompt') dialog.onPromptSubmit?.(inputValue);
                                        else if (dialog.type === 'confirm') dialog.onConfirm?.();
                                        closeDialog();
                                    }}
                                    className={cn("px-6 py-2 rounded-xl font-black shadow-lg transition-all active:scale-95 cursor-pointer",
                                        dialog.type === 'alert'
                                            ? (dialog.isSuccess ? "bg-brand-success text-zinc-950 hover:bg-emerald-400" : "bg-brand-primary text-zinc-950 hover:bg-brand-secondary")
                                            : (dialog.type === 'prompt' ? "bg-brand-primary text-zinc-950 hover:bg-brand-secondary" : "bg-brand-error text-white hover:bg-red-500")
                                    )}
                                >
                                    {dialog.type === 'alert' ? 'Entendido' : (dialog.confirmText || 'Confirmar')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DialogContext.Provider>
    );
}

export function useDialog() {
    const context = useContext(DialogContext);
    if (!context) throw new Error('useDialog debe usarse dentro de un DialogProvider');
    return context;
}