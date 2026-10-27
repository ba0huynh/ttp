/** Colour name rendered as plain text label. */
export function ColorLabel({
  name,
}: {
  name: string
  hex?: string | null
}) {
  return <span>{name}</span>
}
