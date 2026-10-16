import { modelLabel } from '#/lib/business.ts'

/** One motorcycle model in a dropdown: brand / line / year */
export function ModelOption({
  model,
}: {
  model: {
    brand?: string | null
    name: string
    modelYear?: string | null
  }
}) {
  return <span>{modelLabel(model)}</span>
}
