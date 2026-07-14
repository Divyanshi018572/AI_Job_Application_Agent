"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)

    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
    >
      {loading ? (
        <Spinner className="size-3.5" />
      ) : (
        <LogOut className="size-3.5" />
      )}
      Sign out
    </Button>
  )
}

