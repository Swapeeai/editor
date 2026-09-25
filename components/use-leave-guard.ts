"use client"

import { useEffect } from "react"

export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) {
      return
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      const anchor = target.closest("a")
      if (!anchor) {
        return
      }
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || anchor.target === "_blank") {
        return
      }
      const ok = window.confirm("Uploads are still running. Leave this page anyway?")
      if (!ok) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [active])
}
