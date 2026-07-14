"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/dashboard"
  const urlError = searchParams.get("error")
  const urlMessage = searchParams.get("message")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(urlError)
  const [info, setInfo] = useState<string | null>(urlMessage)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    setResendMessage(null)
    setNeedsVerification(false)

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Invalid email or password")
      setNeedsVerification(Boolean(data.needsVerification))
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  async function handleResendVerification() {
    setResendLoading(true)
    setResendMessage(null)

    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    const data = await response.json()
    setResendMessage(data.message ?? data.error ?? "Request completed.")
    setResendLoading(false)
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to manage your job applications"
      footer={
        <p>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <FieldGroup>
          {info ? (
            <Alert>
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>

          {needsVerification ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                Verify your email before signing in.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resendLoading || !email}
                onClick={handleResendVerification}
              >
                {resendLoading ? <Spinner className="size-4" /> : null}
                Resend verification email
              </Button>
              {resendMessage ? (
                <FieldError>{resendMessage}</FieldError>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner className="size-4" /> : null}
            Sign in
          </Button>
        </FieldGroup>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <GoogleSignInButton next={next} />
    </AuthShell>
  )
}
