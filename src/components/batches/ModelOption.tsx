import { ColorLabel } from '#/components/ui/color-label.tsx'
import { modelLabel } from '#/lib/business.ts'

/** One motorcycle model in a dropdown: brand / line / year, then its colour */
export function ModelOption({
  model,
  colors,
}: {
  model: {
    brand?: string | null
    name: string
    modelYear?: string | null
    colorId?: number | null
  }
  colors: { id: number; name: string; hex: string | null }[]
}) {
  const color = colors.find((c) => c.id === model.colorId)
  return (
    <span className="flex items-center gap-3">
      <span>{modelLabel(model)}</span>
      {color && <ColorLabel name={color.name} hex={color.hex} />}
    </span>
  )
}
