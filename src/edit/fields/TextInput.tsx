type Props = {
  label: string
  value: string
  onChange: (next: string) => void
  hasError?: boolean
}

export default function TextInput({ label, value, onChange, hasError }: Props) {
  return (
    <label className="block mb-3">
      <div className="text-mono-xs text-quaternary mb-1">{label}</div>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-default border rounded px-2 py-1.5 text-sans-sm text-default focus:outline-none focus:border-accent-secondary ${
          hasError ? 'border-destructive' : 'border-default'
        }`}
      />
    </label>
  )
}
