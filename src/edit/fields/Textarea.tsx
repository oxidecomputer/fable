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
  rows = 6,
}: Props) {
  return (
    <label className="block mb-3">
      {label && <div className="text-mono-xs text-quaternary mb-1">{label}</div>}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        className={`w-full bg-default border rounded px-2 py-1.5 text-sans-sm text-default focus:outline-none focus:border-accent-secondary resize-y ${
          monospace ? 'font-mono text-sans-sm leading-snug' : ''
        } ${hasError ? 'border-destructive' : 'border-default'}`}
      />
    </label>
  )
}
