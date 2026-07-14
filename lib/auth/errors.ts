export const GENERIC_AUTH_ERROR = "Invalid email or password"

export function mapAuthErrorMessage(error: { message?: string } | null) {
  if (!error?.message) {
    return GENERIC_AUTH_ERROR
  }

  const message = error.message.toLowerCase()

  if (message.includes("email not confirmed")) {
    return "Please verify your email before signing in."
  }

  if (message.includes("invalid login credentials")) {
    return GENERIC_AUTH_ERROR
  }

  if (message.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead."
  }

  if (message.includes("password")) {
    return "Password does not meet the requirements."
  }

  if (message.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again."
  }

  return "Something went wrong. Please try again."
}
