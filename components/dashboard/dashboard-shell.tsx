"use client"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { OnboardingResumeModal } from "@/components/dashboard/onboarding-resume-modal"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

type DashboardShellProps = {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "19rem",
          "--sidebar-width-icon": "4.25rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="dashboard-content min-h-svh bg-white">
        <OnboardingResumeModal />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
