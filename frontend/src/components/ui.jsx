// src/components/ui.jsx
// Small shared building blocks. Styling follows the login page:
// slate surfaces, blue-600 actions, rounded-lg controls.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

const BTN = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    'danger-outline': 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
}
const SIZE = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm' }

export function Button({ variant = 'primary', size = 'md', busy, className = '', children, ...props }) {
    return (
        <button
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition
                disabled:cursor-not-allowed disabled:opacity-50
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1
                ${BTN[variant]} ${SIZE[size]} ${className}`}
            disabled={busy || props.disabled}
            {...props}
        >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {children}
        </button>
    )
}

export const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 ' +
    'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40'

export function Input(props) {
    return <input className={inputClass} {...props} />
}

export function Select({ options, placeholder, small, ...props }) {
    return (
        <select className={small ? `${inputClass} py-1.5 text-xs` : inputClass} {...props}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => (
                <option key={o} value={o}>
                    {o}
                </option>
            ))}
        </select>
    )
}

export function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
        </label>
    )
}

export function Modal({ open, title, onClose, children, footer, width = 'max-w-md' }) {
    useEffect(() => {
        if (!open) return
        const onKey = (e) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`w-full ${width} rounded-xl bg-white shadow-xl`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                    <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-4 px-5 py-4">{children}</div>
                {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
            </div>
        </div>
    )
}

/** Confirmation dialog. With `typeToConfirm`, the admin must type that text first. */
export function ConfirmModal({ open, title, message, confirmLabel, typeToConfirm, busy, onConfirm, onClose }) {
    const [typed, setTyped] = useState('')
    useEffect(() => setTyped(''), [open])
    const ready = !typeToConfirm || typed === typeToConfirm
    return (
        <Modal
            open={open}
            title={title}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="danger" busy={busy} disabled={!ready} onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <p className="text-sm leading-relaxed text-slate-600">{message}</p>
            {typeToConfirm && (
                <Field label={`Type ${typeToConfirm} to confirm`}>
                    <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
                </Field>
            )}
        </Modal>
    )
}

export function PageHeader({ title, description, actions }) {
    return (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
                {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
        </div>
    )
}

export function Panel({ title, actions, children, className = '' }) {
    return (
        <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
            {title && (
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                    <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
                    {actions}
                </div>
            )}
            {children}
        </section>
    )
}

export function Badge({ tone = 'slate', children }) {
    const tones = {
        slate: 'bg-slate-100 text-slate-600',
        blue: 'bg-blue-50 text-blue-700',
        green: 'bg-emerald-50 text-emerald-700',
        amber: 'bg-amber-50 text-amber-700',
        red: 'bg-red-50 text-red-700',
    }
    return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

/** Wraps any data view: spinner while loading, error with retry, else children. */
export function DataState({ loading, error, onRetry, children }) {
    if (loading)
        return (
            <div className="flex items-center gap-2 px-5 py-10 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading from the cluster…
            </div>
        )
    if (error)
        return (
            <div className="flex flex-wrap items-center gap-3 px-5 py-6 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" /> {error}
                {onRetry && (
                    <Button size="sm" variant="secondary" onClick={onRetry}>
                        Try again
                    </Button>
                )}
            </div>
        )
    return children
}

export function Empty({ children }) {
    return <p className="px-5 py-10 text-center text-sm text-slate-400">{children}</p>
}

/** Table with consistent styling. columns: [{key, label, className?}] */
export function Table({ columns, rows, rowKey, render }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500">
                        {columns.map((c) => (
                            <th key={c.key} className={`px-5 py-2.5 font-medium ${c.className || ''}`}>
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                        <tr key={rowKey(row)} className="hover:bg-slate-50/60">
                            {columns.map((c) => (
                                <td key={c.key} className={`px-5 py-3 text-slate-700 ${c.className || ''}`}>
                                    {render(row, c.key)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ---------- toasts ----------
const ToastContext = createContext(null)

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const show = useCallback((type, message) => {
        const id = Math.random()
        setToasts((t) => [...t, { id, type, message }])
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 8000 : 4000)
    }, [])
    const value = { success: (m) => show('success', m), error: (m) => show('error', m) }
    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg ${
                            t.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-white text-slate-700'
                        }`}
                    >
                        {t.type === 'error' ? (
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        ) : (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                        )}
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => useContext(ToastContext)

/**
 * Run a write request with a busy flag and toast feedback.
 *   const [run, busy] = useAction()
 *   run(() => api('/qos/', {method: 'POST', body}), { onDone: reload })
 */
export function useAction() {
    const toast = useToast()
    const [busy, setBusy] = useState(false)
    const run = useCallback(
        async (fn, { onDone } = {}) => {
            setBusy(true)
            try {
                const res = await fn()
                if (res?.message) toast.success(res.message)
                onDone?.(res)
                return res
            } catch (e) {
                const steps = e.body?.completed_steps
                toast.error(steps?.length ? `${e.message} Already done before the failure: ${steps.join(', ')}.` : e.message)
                return null
            } finally {
                setBusy(false)
            }
        },
        [toast],
    )
    return [run, busy]
}
