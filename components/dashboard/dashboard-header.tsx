"use client"

import * as React from "react"
import Link from "next/link"
import { LogoutButton } from "@/components/auth/logout-button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type DashboardHeaderProps = {
  title: string
  description?: string
}

function UserAvatarWidget() {
  const [avatarUrl, setAvatarUrl] = React.useState<string>("")
  const [name, setName] = React.useState<string>("")

  React.useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setAvatarUrl(data.profile.avatar_url || data.profile.parsed_data?.profile?.avatarUrl || "")
            setName(data.profile.full_name || data.profile.parsed_data?.profile?.fullName || "User")
          }
        }
      } catch {
        // ignore
      }
    }
    void loadUser()
  }, [])

  return (
    <Link href="/dashboard/profile" title="View Profile" className="flex items-center gap-2 transition-opacity hover:opacity-80">
      <Avatar className="size-9 border-2 border-indigo-400/40 shadow-sm">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
          {(name || "U").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </Link>
  )
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

      <div className="flex items-center gap-3 shrink-0">
        <UserAvatarWidget />
        <LogoutButton />
      </div>
    </header>
  )
}

