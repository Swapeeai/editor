import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { productionRequiresLogin } from "@/lib/access"
import { readAllowedUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function LibraryLayout({ children }: { children: ReactNode }) {
  if (!productionRequiresLogin()) {
    return children
  }

  const user = await readAllowedUser()
  if (!user) {
    redirect("/login")
  }

  return (
    <>
      <div className="border-b bg-muted/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2 text-sm">
          <p>Signed in as {user.email}</p>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </>
  )
}
