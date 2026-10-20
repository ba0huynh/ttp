import { modelLabel } from '#/lib/business.ts'

/** One motorcycle model in a dropdown: brand / line */
export function ModelOption({
  model,
}: {
  model: {
    brand?: string | null
    name: string
  }
}) {
  return <span>{modelLabel(model)}</span>
}
