"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles } from "lucide-react"

import { CreditsDisplay } from "@/components/dashboard/credits-display"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  footerNavItems,
  mainNavItems,
} from "@/lib/dashboard/navigation"
import { cn } from "@/lib/utils"

const navButtonClassName = cn(
  "h-11 gap-3 px-3 text-[15px] text-white/80 hover:bg-white/10 hover:text-white",
  "[&_svg]:size-5",
  "group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:!p-2.5"
)

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarLogo() {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex items-center gap-3.5 rounded-xl px-1 py-2.5 transition-colors hover:bg-white/10",
        collapsed && "justify-center px-0"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30",
          collapsed ? "size-11" : "size-12"
        )}
      >
        <Sparkles className={cn(collapsed ? "size-5" : "size-6")} />
      </div>
      {!collapsed ? (
        <div className="min-w-0 leading-snug">
          <p className="truncate text-lg font-bold tracking-tight text-white">
            JobHunter AI
          </p>
          <p className="truncate text-xs text-white/60">Smart job applications</p>
        </div>
      ) : null}
    </Link>
  )
}

function NavItems({
  items,
  label,
}: {
  items: typeof mainNavItems
  label?: string
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup className="px-2.5 py-2">
      {label ? (
        <SidebarGroupLabel className="h-7 px-2 text-[11px] font-semibold tracking-widest text-white/45 uppercase">
          {label}
        </SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href)

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  size="lg"
                  tooltip={item.title}
                  render={<Link href={item.href} />}
                  className={cn(
                    navButtonClassName,
                    active &&
                      "bg-gradient-to-r from-indigo-500/25 to-violet-500/20 font-semibold text-white shadow-sm ring-1 ring-white/10"
                  )}
                >
                  <item.icon className={cn(active && "text-indigo-200")} />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  return (
    <Sidebar
      collapsible="icon"
      className="[&_[data-slot=sidebar-inner]]:border-white/10 [&_[data-slot=sidebar-inner]]:bg-gradient-to-b [&_[data-slot=sidebar-inner]]:from-[#1a1f4b] [&_[data-slot=sidebar-inner]]:via-[#151b33] [&_[data-slot=sidebar-inner]]:to-[#0b1020] [&_[data-slot=sidebar-inner]]:text-white"
    >
      <SidebarHeader className="border-b border-white/10 px-3 py-3.5">
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent className="gap-1 py-2">
        <NavItems items={mainNavItems} label="Workspace" />
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 pb-2">
        <div className={cn("px-2.5 py-2", collapsed && "flex justify-center px-0")}>
          <CreditsDisplay collapsed={collapsed} />
        </div>

        <SidebarSeparator className="bg-white/10" />

        <NavItems items={footerNavItems} />
      </SidebarFooter>

      <SidebarRail className="after:bg-white/20 hover:after:bg-white/35" />
    </Sidebar>
  )
}
