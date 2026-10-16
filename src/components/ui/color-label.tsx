/** Colour name with a round swatch of its hex value (used in colour dropdowns). */
export function ColorLabel({
  name,
  hex,
}: {
  name: string
  hex?: string | null
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block size-3.5 shrink-0 rounded-full border border-slate-300"
        style={{ backgroundColor: hex || 'transparent' }}
      />
      {name}
    </span>
  )
}
