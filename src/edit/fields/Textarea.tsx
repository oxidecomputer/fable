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
      <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
        {label}
      </div>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        className={`w-full bg-neutral-900 border rounded px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y ${
          monospace ? 'font-mono text-xs leading-snug' : ''
        } ${hasError ? 'border-red-500' : 'border-neutral-700'}`}
      />
    </label>
  )
}
