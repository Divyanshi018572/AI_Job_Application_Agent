import {
  Briefcase,
  ClipboardList,
  CreditCard,
  FileText,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react"

export type DashboardNavItem = {
  title: string
  href: string
  icon: LucideIcon
}

export const mainNavItems: DashboardNavItem[] = [
  {
    title: "Jobs",
    href: "/dashboard/jobs",
    icon: Briefcase,
  },
  {
    title: "Resume",
    href: "/dashboard/resume",
    icon: FileText,
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: User,
  },
  {
    title: "Application Status",
    href: "/dashboard/application-status",
    icon: ClipboardList,
  },
]

export const footerNavItems: DashboardNavItem[] = [
  {
    title: "Billing / Credits",
    href: "/dashboard/billing",
    icon: CreditCard,
  },
  {
    title: "Profile Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export const creditsPlaceholder = {
  used: 380,
  total: 500,
}
