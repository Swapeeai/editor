export async function signedDownloadUrl(id: string) {
  const response = await fetch("/api/media/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  const body = (await response.json()) as { error?: string; url?: string }
  if (!response.ok || !body.url) {
    throw new Error(body.error || "Could not download that file.")
  }
  return body.url
}

export function startSignedDownload(url: string) {
  const frame = document.createElement("iframe")
  frame.title = ""
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;border:0;opacity:0"
  frame.src = url
  document.body.appendChild(frame)
  window.setTimeout(() => frame.remove(), 120000)
}

export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
