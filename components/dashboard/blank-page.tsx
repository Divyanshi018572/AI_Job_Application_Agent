type BlankPageProps = {
  title: string
  description?: string
}

export function BlankPage({ title, description }: BlankPageProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card/80 p-10 text-center shadow-sm backdrop-blur-sm">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <span className="text-lg font-semibold">{title.charAt(0)}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {description ?? "Content coming soon."}
        </p>
      </div>
    </div>
  )
}
