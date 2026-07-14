"use client"

import { LogoutButton } from "@/components/auth/logout-button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

type DashboardHeaderProps = {
  title: string
  description?: string
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <SidebarTrigger className="text-muted-foreground hover:bg-muted/80" />
        <Separator orientation="vertical" className="hidden h-5 sm:block" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">
            {title}
          </h1>
          {description ? (
            <p className="truncate text-xs text-muted-foreground md:text-sm">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <LogoutButton />
      </div>
    </header>
  )
}

