import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ProfileEditor } from "@/components/dashboard/profile-editor"

export default function ProfilePage() {
  return (
    <>
      <DashboardHeader
        title="Candidate Profile"
        description="Your AI-extracted professional profile and career details"
      />
      <div className="p-6">
        <ProfileEditor />
      </div>
    </>
  )
}
