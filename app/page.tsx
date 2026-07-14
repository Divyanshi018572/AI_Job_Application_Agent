import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <main className="relative flex min-h-svh flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b1020] via-[#100818] to-black" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18)_0%,transparent_65%)]" />
      <div className="pointer-events-none absolute top-1/4 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-10">
        <p className="text-sm font-semibold tracking-[0.2em] text-violet-300/90 uppercase sm:text-base">
          JobHunter AI
        </p>

        <div className="space-y-6">
          <h1 className="text-4xl leading-[1.1] font-bold tracking-tight text-balance text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Apply{" "}
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-400 bg-clip-text text-transparent">
              smarter
            </span>
            . Track{" "}
            <span className="text-violet-300">every application</span> in one
            place.
          </h1>

          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-pretty text-white/70 sm:text-xl md:text-2xl">
            Sign up to save applications, manage your pipeline, and let{" "}
            <span className="font-medium text-violet-300">AI</span> help you
            tailor resumes and cover letters.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            nativeButton={false}
            className="h-14 rounded-xl border-0 bg-gradient-to-r from-violet-600 to-indigo-600 px-10 text-base font-semibold text-white shadow-xl shadow-violet-600/30 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 sm:h-16 sm:px-12 sm:text-lg"
            render={<Link href="/signup" />}
          >
            Get started
          </Button>

          <Button
            nativeButton={false}
            variant="outline"
            className="h-12 rounded-xl border-white/20 bg-white/5 px-8 text-base text-white hover:bg-white/10 hover:text-white sm:h-14 sm:px-10"
            render={<Link href="/login" />}
          >
            Sign in
          </Button>

          <Button
            nativeButton={false}
            variant="ghost"
            className="h-12 px-6 text-base text-white/60 hover:bg-white/5 hover:text-violet-300 sm:h-14"
            render={<Link href="/dashboard" />}
          >
            Dashboard
          </Button>
        </div>
      </div>
    </main>
  )
}
