import { Suspense } from "react"

import LoginForm from "./login-form"

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full flex-1 items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
