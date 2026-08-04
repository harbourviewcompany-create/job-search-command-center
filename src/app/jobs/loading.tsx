export default function JobsLoading() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Loading jobs">
      <div className="h-56 animate-pulse rounded-3xl bg-slate-900" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card h-32 animate-pulse bg-white p-4">
            <div className="h-9 w-9 rounded-xl bg-slate-100" />
            <div className="mt-3 h-7 w-12 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="card h-20 animate-pulse bg-white" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card h-80 animate-pulse bg-white p-5">
            <div className="h-5 w-28 rounded bg-slate-100" />
            <div className="mt-4 h-7 w-3/4 rounded bg-slate-100" />
            <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
            <div className="mt-8 space-y-3">
              <div className="h-4 w-full rounded bg-slate-100" />
              <div className="h-4 w-5/6 rounded bg-slate-100" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading the job pipeline…</span>
    </div>
  )
}
