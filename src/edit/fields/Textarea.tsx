import { useLayoutEffect, useRef } from 'react'

const MAX_HEIGHT = 320

type Props = {
  label: string
  value: string
  onChange: (next: string) => void
  hasError?: boolean
  monospace?: boolean
  rows?: number
}

export default function Textarea({
  label,
  value,
  onChange,
  hasError,
  monospace,
  rows = 2,
}: Props) {
  // Grow with content (up to a cap) instead of reserving fixed rows.
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, MAX_HEIGHT)}px`
  }, [value])

  return (
    <label className="block mb-3">
      {label && <div className="text-mono-xs text-quaternary mb-1">{label}</div>}
      <textarea
        ref={ref}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        className={`w-full bg-default border rounded px-2 py-1.5 text-sans-sm text-default focus:outline-none focus:border-accent-secondary resize-none overflow-y-auto ${
          monospace ? 'font-mono text-sans-sm leading-snug' : ''
        } ${hasError ? 'border-destructive' : 'border-default'}`}
      />
    </label>
  )
}
