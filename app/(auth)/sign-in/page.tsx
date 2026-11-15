import type { Metadata } from "next"

import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = { title: "Sign in · CareerMatch AI" }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { next } = await searchParams
  return (
    <AuthForm
      mode="sign-in"
      next={typeof next === "string" ? next : undefined}
    />
  )
}
