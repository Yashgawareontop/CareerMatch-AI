"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"

const JOB_TYPES = [
  { value: "internship", label: "Internship" },
  { value: "full-time", label: "Full-time" },
  { value: "remote", label: "Remote" },
] as const

type JobType = (typeof JOB_TYPES)[number]["value"]

const currentYear = new Date().getFullYear()

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  education: z.string().trim().min(1, "Required").max(200),
  graduationYear: z.coerce
    .number<string>()
    .int("Enter a year")
    .min(1950, "Enter a valid year")
    .max(currentYear + 10, "Enter a valid year"),
  location: z.string().trim().min(1, "Required").max(200),
  preferredRoles: z.string().trim().min(1, "Add at least one role"),
  jobTypes: z
    .array(z.enum(["internship", "full-time", "remote"]))
    .min(1, "Pick at least one"),
  targetIndustries: z.string(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

/** "a, b ,c" → ["a", "b", "c"] */
const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)

export function ProfileForm({
  profile,
  onSaved,
}: {
  profile: Doc<"profiles"> | null
  onSaved?: () => void
}) {
  const upsert = useMutation(api.profiles.upsertMine)
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" })

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: profile?.name ?? "",
      education: profile?.education ?? "",
      graduationYear: profile ? String(profile.graduationYear) : "",
      location: profile?.location ?? "",
      preferredRoles: profile?.preferredRoles.join(", ") ?? "",
      jobTypes: profile?.jobTypes ?? [],
      targetIndustries: profile?.targetIndustries.join(", ") ?? "",
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setStatus({ kind: "idle" })
    try {
      await upsert({
        name: values.name,
        education: values.education,
        graduationYear: values.graduationYear,
        location: values.location,
        preferredRoles: splitList(values.preferredRoles),
        jobTypes: values.jobTypes,
        targetIndustries: splitList(values.targetIndustries),
      })
      setStatus({ kind: "saved" })
      onSaved?.()
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof ConvexError && typeof error.data === "string"
            ? error.data
            : "Could not save. Please try again.",
      })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field label="Full name" id="name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" {...register("name")} />
      </Field>

      <Field
        label="Education"
        id="education"
        hint="Degree and institution, e.g. B.Tech CSE, IIT Bombay"
        error={errors.education?.message}
      >
        <Input id="education" {...register("education")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Graduation year"
          id="graduationYear"
          error={errors.graduationYear?.message}
        >
          <Input
            id="graduationYear"
            inputMode="numeric"
            placeholder={String(currentYear)}
            {...register("graduationYear")}
          />
        </Field>
        <Field label="Location" id="location" error={errors.location?.message}>
          <Input
            id="location"
            autoComplete="address-level2"
            placeholder="e.g. Pune, India"
            {...register("location")}
          />
        </Field>
      </div>

      <Field
        label="Preferred roles"
        id="preferredRoles"
        hint="Comma-separated, e.g. Frontend Developer, Data Analyst"
        error={errors.preferredRoles?.message}
      >
        <Input id="preferredRoles" {...register("preferredRoles")} />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Job type</legend>
        <Controller
          control={control}
          name="jobTypes"
          render={({ field }) => (
            <div className="flex flex-wrap gap-5">
              {JOB_TYPES.map((type) => {
                const checked = field.value.includes(type.value)
                return (
                  <Label
                    key={type.value}
                    className="flex items-center gap-2 font-normal"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) => {
                        const set = new Set<JobType>(field.value)
                        if (next) set.add(type.value)
                        else set.delete(type.value)
                        field.onChange([...set])
                      }}
                    />
                    {type.label}
                  </Label>
                )
              })}
            </div>
          )}
        />
        {errors.jobTypes && (
          <p className="text-xs text-destructive">{errors.jobTypes.message}</p>
        )}
      </fieldset>

      <Field
        label="Target industries"
        id="targetIndustries"
        hint="Optional, comma-separated, e.g. Fintech, Healthcare"
        error={errors.targetIndustries?.message}
      >
        <Input id="targetIndustries" {...register("targetIndustries")} />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save preferences"}
        </Button>
        {status.kind === "saved" && (
          <p className="text-sm text-muted-foreground" role="status">
            Saved
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {status.message}
          </p>
        )}
      </div>
    </form>
  )
}

function Field({
  label,
  id,
  hint,
  error,
  children,
}: {
  label: string
  id: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
