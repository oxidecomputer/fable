type Props = {
  label: string
  value: string | undefined
  options: readonly string[]
  onChange: (next: string | undefined) => void
  hasError?: boolean
  optional?: boolean
}

export default function SelectField({
  label,
  value,
  options,
  onChange,
  hasError,
  optional,
}: Props) {
  return (
    <label className="block mb-3">
      <div className="text-mono-xs text-quaternary mb-1">{label}</div>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const next = e.target.value
          onChange(next === '' ? undefined : next)
        }}
        className={`w-full bg-default border rounded px-2 py-1.5 text-sans-sm text-default focus:outline-none focus:border-accent-secondary ${
          hasError ? 'border-destructive' : 'border-default'
        }`}
      >
        {optional && <option value="">—</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}
