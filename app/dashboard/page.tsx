import { BlankPage } from "@/components/dashboard/blank-page"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default function DashboardPage() {
  return (
    <>
      <DashboardHeader
        title="Dashboard"
        description="Your job search command center"
      />
      <BlankPage
        title="Dashboard"
        description="Overview and insights will appear here soon."
      />
    </>
  )
}
