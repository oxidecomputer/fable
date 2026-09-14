import type { ComponentProps, ReactNode } from 'react'

/**
 * Shared chrome primitives for the edit UI, so control styling lives in one
 * place. Layout concerns (flex-1, shrink-0, margins) stay with the caller
 * via className.
 */

const BUTTON_VARIANTS = {
  primary:
    'text-mono-sm text-accent bg-accent-secondary hover:bg-accent-secondary-hover rounded px-4 py-2',
  secondary:
    'text-mono-xs text-default bg-default hover:bg-hover border border-default rounded px-2 py-1.5',
  destructive:
    'text-mono-xs text-destructive bg-default hover:bg-hover border border-default rounded px-2 py-1.5',
  /** For use inside a NoticeBox — inherits the notice text color. */
  notice: 'text-mono-xs border border-notice rounded px-2 py-0.5 hover:bg-hover',
} as const

export function Button({
  variant = 'secondary',
  type = 'button',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      type={type}
      className={`${BUTTON_VARIANTS[variant]} disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={`fable-select bg-default border border-default rounded text-sans-sm py-1.5 pl-2 pr-7 text-default disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}

const INPUT_VARIANTS = {
  default:
    'bg-raise border border-default rounded text-sans-md px-3 py-2 text-default placeholder:text-quaternary focus:outline-none focus:border-accent-secondary',
  /** Borderless inline field (e.g. the deck title) that raises on focus. */
  ghost:
    'bg-transparent text-sans-sm font-semibold text-default placeholder:text-quaternary outline-none focus:bg-default rounded px-1 py-0.5',
} as const

export function Input({
  variant = 'default',
  className = '',
  ...props
}: ComponentProps<'input'> & { variant?: keyof typeof INPUT_VARIANTS }) {
  return <input className={`${INPUT_VARIANTS[variant]} ${className}`} {...props} />
}

/** Quiet status text: empty states, loading messages, hints. */
export function Muted({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={`text-mono-xs text-quaternary ${className}`}>{children}</div>
}

export function ErrorText({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={`text-mono-xs text-destructive ${className}`}>{children}</div>
}

/** Full-height centered shell for app-level notices (no backend, connecting…). */
export function CenteredNotice({ children }: { children: ReactNode }) {
  return (
    <div className="fable-editor flex h-full items-center justify-center bg-default">
      {children}
    </div>
  )
}

/** Warning surface (schema issues, missing fields); caller adds padding/typography. */
export function NoticeBox({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`rounded border border-notice bg-notice text-notice ${className}`}>
      {children}
    </div>
  )
}

/** Fill-height editor column with an optional error footer. */
export function EditorPane({
  error,
  children,
}: {
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      {children}
      {error && (
        <ErrorText className="shrink-0 mt-2 whitespace-pre-wrap">{error}</ErrorText>
      )}
    </div>
  )
}
