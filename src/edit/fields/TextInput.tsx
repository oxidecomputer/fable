type Props = {
  label: string
  value: string
  onChange: (next: string) => void
  hasError?: boolean
}

export default function TextInput({ label, value, onChange, hasError }: Props) {
  return (
    <label className="block mb-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
        {label}
      </div>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-neutral-900 border rounded px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
          hasError ? 'border-red-500' : 'border-neutral-700'
        }`}
      />
    </label>
  )
}
