import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { JobsListView } from "@/components/dashboard/jobs-list-view"

export default function JobsPage() {
  return (
    <>
      <DashboardHeader
        title="Jobs"
        description="Discover and manage job opportunities"
      />
      <div className="p-6">
        <JobsListView />
      </div>
    </>
  )
}
