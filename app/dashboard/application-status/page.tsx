import { BlankPage } from "@/components/dashboard/blank-page"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default function ApplicationStatusPage() {
  return (
    <>
      <DashboardHeader
        title="Application Status"
        description="Track every application in your pipeline"
      />
      <BlankPage
        title="Application Status"
        description="Application tracking and status updates coming soon."
      />
    </>
  )
}
