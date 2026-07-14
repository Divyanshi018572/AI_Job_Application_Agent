import { BlankPage } from "@/components/dashboard/blank-page"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export default function BillingPage() {
  return (
    <>
      <DashboardHeader
        title="Billing / Credits"
        description="Manage your plan and credit usage"
      />
      <BlankPage
        title="Billing / Credits"
        description="Billing, plans, and credit management coming soon."
      />
    </>
  )
}
