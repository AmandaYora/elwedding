import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

/** Tabel modern dengan efek hover baris dan pemisah yang halus */
export function Table({ className = '', children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto w-full">
      <table className={['w-full text-sm text-left border-collapse', className].join(' ')} {...props}>
        {children}
      </table>
    </div>
  )
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
}

export function Tr({ className = '', children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={['transition-colors duration-100 hover:bg-slate-50/70', className].join(' ')}
      {...props}
    >
      {children}
    </tr>
  )
}

export function Th({ className = '', children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={[
        'h-10 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({ className = '', children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={['py-3.5 px-4 text-slate-800 align-middle', className].join(' ')} {...props}>
      {children}
    </td>
  )
}

