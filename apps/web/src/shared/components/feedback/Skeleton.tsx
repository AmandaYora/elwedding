interface SkeletonProps {
  className?: string
}

/** Skeleton loader modern dengan efek animasi pulse lembut */
export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return <div className={['animate-pulse rounded-lg bg-slate-200/80', className].join(' ')} aria-hidden="true" />
}

/** Skeleton tabel modern */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex gap-4 pb-2 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-4 flex-1 rounded bg-slate-200" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 items-center py-1.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1 rounded-md bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  )
}

