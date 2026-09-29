import { LoginForm } from "@/components/login-form"

export const dynamic = "force-dynamic"

const errors: Record<string, string> = {
  "not-allowed": "That email is not on the list.",
  link: "That sign-in link did not work. Request a new one.",
  config: "Sign-in is not configured on the server yet.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; sent?: string }>
}) {
  const params = await searchParams
  const error = params.error ? errors[params.error] ?? "Sign-in did not work." : null
  const next = params.next ?? "/"

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-base leading-7 text-muted-foreground">
          This library is private. Enter the email Suzanne allowed and we will send a sign-in link. Any other email is refused.
        </p>
      </div>
      <LoginForm nextPath={next} error={error} />
    </div>
  )
}
