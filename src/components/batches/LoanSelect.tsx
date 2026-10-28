import { useQuery } from '@tanstack/react-query'

import { BankLabel } from '#/components/finance/BankLabel.tsx'
import {
  SearchSelect,
  SearchSelectItem,
} from '#/components/ui/search-select.tsx'
import { loansQuery } from '#/lib/queries.ts'

/** Sentinel option: the batch is not financed by a bank loan */
const NO_LOAN = '0'

/** Optional bank loan contract (khế ước) financing a batch */
export function LoanSelect({
  value,
  onChange,
}: {
  /** 0 = no loan */
  value: number
  onChange: (id: number) => void
}) {
  const { data: loans } = useQuery(loansQuery())

  return (
    <SearchSelect
      className="h-11 w-full text-sm bg-white rounded-lg"
      placeholder="Chọn khế ước vay"
      searchPlaceholder="Tìm theo số khế ước, ngân hàng..."
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
    >
      <SearchSelectItem value={NO_LOAN}>Không vay</SearchSelectItem>
      {(loans ?? []).map((l) => (
        <SearchSelectItem
          key={l.id}
          value={String(l.id)}
          keywords={`${l.contractNumber} ${l.bankName ?? ''} ${l.accountNumber ?? ''}`}
        >
          <BankLabel image={l.bankImage} name={l.bankName}>
            {l.contractNumber} · {l.bankName}
            {l.accountNumber ? ` (${l.accountNumber})` : ''}
          </BankLabel>
        </SearchSelectItem>
      ))}
    </SearchSelect>
  )
}
