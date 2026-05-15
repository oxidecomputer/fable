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
      <div className="text-mono-xs text-quaternary mb-1">{label}</div>
      {items.map((item, i) => (
        <div key={i} className="mb-2 border border-default rounded">
          <div className="flex items-center justify-between px-2 py-1 text-mono-xs bg-default text-quaternary">
            <span>#{i + 1}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="px-1 disabled:opacity-30 hover:text-default"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="px-1 disabled:opacity-30 hover:text-default"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="px-1 hover:text-destructive"
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
        className="text-mono-xs text-accent-secondary hover:text-accent"
      >
        + add item
      </button>
    </div>
  )
}
