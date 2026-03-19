import { useEffect, useRef, useState } from 'react'

export type ToastType = 'error' | 'success' | 'loading'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  /** ms before auto-dismiss. 0 = never (use for loading). Default 4000 */
  duration?: number
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Animate in
    const raf = requestAnimationFrame(() => setVisible(true))
    const duration = toast.duration ?? (toast.type === 'loading' ? 0 : 4000)
    if (duration > 0) {
      timerRef.current = setTimeout(onDismiss, duration)
    }
    return () => {
      cancelAnimationFrame(raf)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.duration, toast.type, onDismiss])

  const colors: Record<ToastType, { bg: string; border: string; icon: string; bar: string }> = {
    error: {
      bg: '#140a0a',
      border: '#3a1010',
      icon: '#ef4444',
      bar: '#ef4444',
    },
    success: {
      bg: '#0a140a',
      border: '#1a3a1a',
      icon: '#22c55e',
      bar: '#22c55e',
    },
    loading: {
      bg: '#0d0d1a',
      border: '#2a2a5a',
      icon: '#6366f1',
      bar: '#6366f1',
    },
  }
  const c = colors[toast.type]

  function icon() {
    if (toast.type === 'loading') {
      return (
        <svg
          width='14'
          height='14'
          viewBox='0 0 24 24'
          fill='none'
          aria-hidden='true'
          style={{ animation: 'toast-spin 0.8s linear infinite', flexShrink: 0 }}
        >
          <circle cx='12' cy='12' r='9' stroke={c.icon} strokeWidth='2' strokeOpacity='0.25' />
          <path d='M12 3a9 9 0 0 1 9 9' stroke={c.icon} strokeWidth='2' strokeLinecap='round' />
        </svg>
      )
    }
    if (toast.type === 'success') {
      return (
        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true' style={{ flexShrink: 0 }}>
          <circle cx='12' cy='12' r='9' stroke={c.icon} strokeWidth='1.5' />
          <path d='M8 12l3 3 5-5' stroke={c.icon} strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      )
    }
    return (
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true' style={{ flexShrink: 0 }}>
        <circle cx='12' cy='12' r='9' stroke={c.icon} strokeWidth='1.5' />
        <path d='M12 8v4M12 16v.5' stroke={c.icon} strokeWidth='1.5' strokeLinecap='round' />
      </svg>
    )
  }

  return (
    <div
      role='alert'
      aria-live='assertive'
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        minWidth: 260,
        maxWidth: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        position: 'relative',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        cursor: toast.type !== 'loading' ? 'pointer' : 'default',
      }}
      onClick={toast.type !== 'loading' ? onDismiss : undefined}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss() }}
    >
      {/* accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: c.bar }} />
      <div style={{ paddingLeft: 4, display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
        <div style={{ paddingTop: 1 }}>{icon()}</div>
        <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5, flex: 1 }}>{toast.message}</span>
        {toast.type !== 'loading' && (
          <button
            type='button'
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            aria-label='Dismiss'
            style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (!toasts.length) return null
  return (
    <>
      <style>{`@keyframes toast-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        aria-label='Notifications'
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem toast={t} onDismiss={() => onDismiss(t.id)} />
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

let _counter = 0
function nextId() {
  _counter += 1
  return `toast-${_counter}`
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  function dismiss(id: string) {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }

  function show(message: string, type: ToastType = 'error', duration?: number): string {
    const id = nextId()
    setToasts((ts) => [...ts, { id, type, message, duration }])
    return id
  }

  function showLoading(message: string): string {
    return show(message, 'loading', 0)
  }

  function resolve(id: string, message: string, type: ToastType = 'success') {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, type, message, duration: 4000 } : t)))
    // auto-dismiss after duration
    setTimeout(() => dismiss(id), 4000)
  }

  return { toasts, show, showLoading, resolve, dismiss }
}