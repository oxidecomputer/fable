import Textarea from './Textarea'

type Props = {
  label: string
  value: string[]
  onChange: (next: string[]) => void
}

export default function StringArrayField({ label, value, onChange }: Props) {
  const items = Array.isArray(value) ? value : []
  const update = (i: number, next: string) => {
    const out = items.slice()
    out[i] = next
    onChange(out)
  }
  const remove = (i: number) => {
    const out = items.slice()
    out.splice(i, 1)
    onChange(out)
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const out = items.slice()
    const [it] = out.splice(i, 1)
    out.splice(j, 0, it)
    onChange(out)
  }
  return (
    <div className="mb-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
        {label}
      </div>
      {items.map((item, i) => (
        <div key={i} className="mb-2 border border-neutral-700 rounded">
          <div className="flex items-center justify-between px-2 py-1 text-xs bg-neutral-900 text-neutral-400">
            <span>#{i + 1}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="px-1 disabled:opacity-30 hover:text-neutral-100"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="px-1 disabled:opacity-30 hover:text-neutral-100"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="px-1 hover:text-red-400"
              >
                ×
              </button>
            </div>
          </div>
          <Textarea
            label=""
            value={item ?? ''}
            onChange={(next) => update(i, next)}
            rows={4}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="text-xs text-indigo-300 hover:text-indigo-100"
      >
        + add item
      </button>
    </div>
  )
}
