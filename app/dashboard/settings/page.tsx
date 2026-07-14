import { BlankPage } from "@/components/dashboard/blank-page"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default function SettingsPage() {
  return (
    <>
      <DashboardHeader
        title="Profile Settings"
        description="Account, security, and notification preferences"
      />
      <BlankPage
        title="Profile Settings"
        description="Account settings and preferences coming soon."
      />
    </>
  )
}
