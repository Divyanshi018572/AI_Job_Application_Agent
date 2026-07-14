import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ResumeListView } from "@/components/dashboard/resume-list-view"

export default function ResumePage() {
  return (
    <>
      <DashboardHeader
        title="Resume Management"
        description="Upload and manage your resumes parsed with Google Gemini AI"
      />
      <div className="p-6">
        <ResumeListView />
      </div>
    </>
  )
}
