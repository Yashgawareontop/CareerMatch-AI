"use client"

import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/convex/_generated/api"

// Mirrors the server rules in @convex-dev/auth (min 10 chars by default).
const MIN_PASSWORD = 10

const schema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(100, "At most 100 characters")
    .refine((s) => s.trim() === s, "No leading or trailing spaces"),
  password: z
    .string()
    .min(MIN_PASSWORD, `At least ${MIN_PASSWORD} characters`)
    .max(100, "At most 100 characters"),
})

type Values = z.infer<typeof schema>

type UserError = { error: string; retryAfterMs?: number }

function errorMessage(userError: UserError): string {
  switch (userError.error) {
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      return "Wrong username or password"
    case "USERNAME_TAKEN":
      return "That username is taken"
    case "USERNAME_HAS_INVALID_CHARACTERS":
      return "The username contains characters that aren't allowed"
    case "PASSWORD_TOO_COMMON":
      return "That password is too common. Pick another one."
    case "PASSWORD_TOO_SHORT":
      return `Password must be at least ${MIN_PASSWORD} characters`
    case "RATE_LIMITED":
      return `Too many attempts. Try again in ${Math.ceil((userError.retryAfterMs ?? 0) / 1000)} seconds.`
    default:
      return "Something went wrong. Please try again."
  }
}

/**
 * Only allow same-site relative paths as the post-sign-in destination.
 * New accounts start with their preferences; returning users see the dashboard.
 */
function safeNext(next: string | undefined, isSignUp: boolean) {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : isSignUp
      ? "/onboarding"
      : "/dashboard"
}

export function AuthForm({
  mode,
  next,
}: {
  mode: "sign-in" | "sign-up"
  next?: string
}) {
  const router = useRouter()
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(api.auth)
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(api.auth)
  const pending = signingIn || signingUp
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const isSignUp = mode === "sign-up"

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = isSignUp ? await signUp(values) : await signIn(values)
    if (result.status !== "complete") {
      setFormError(errorMessage(result.userError))
      return
    }
    router.replace(safeNext(next, isSignUp))
    router.refresh()
  })

  return (
    <Card className="w-full max-w-sm motion-safe:animate-rise">
      <CardHeader>
        <CardTitle className="font-display text-2xl font-semibold tracking-[-0.025em]">
          {isSignUp ? "Create an account" : "Sign in"}
        </CardTitle>
        <CardDescription>
          {isSignUp
            ? "A username and password is all it takes"
            : "Use your CareerMatch AI username and password"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              disabled={pending}
              aria-invalid={Boolean(errors.username)}
              {...register("username")}
            />
            {errors.username && (
              <p className="text-xs text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              disabled={pending}
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? isSignUp
                ? "Creating account…"
                : "Signing in…"
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "New here? "}
            <Link
              href={isSignUp ? "/sign-in" : "/sign-up"}
              className="text-foreground underline underline-offset-4"
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
