import { BlankPage } from "@/components/dashboard/blank-page"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default function JobsPage() {
  return (
    <>
      <DashboardHeader
        title="Jobs"
        description="Discover and manage job opportunities"
      />
      <BlankPage
        title="Jobs"
        description="Job listings and saved roles will appear here soon."
      />
    </>
  )
}
