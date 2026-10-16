import { Search } from 'lucide-react'

import { Input } from '#/components/ui/input.tsx'

/** Small search field with a magnifier icon, for the toolbar of a list card */
export function SearchBox({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  className = 'w-64',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-slate-400" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 text-xs"
        autoComplete="off"
      />
    </div>
  )
}
