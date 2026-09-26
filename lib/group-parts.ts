import type { SampleMedia } from "@/lib/sample-media"

export function groupWithParts(items: SampleMedia[]) {
  const ids = new Set(items.map((item) => item.id))
  const partsBySource = new Map<string, SampleMedia[]>()
  const roots: SampleMedia[] = []
  for (const item of items) {
    if (item.sourceMediaId && ids.has(item.sourceMediaId)) {
      const list = partsBySource.get(item.sourceMediaId) ?? []
      list.push(item)
      partsBySource.set(item.sourceMediaId, list)
    } else {
      roots.push(item)
    }
  }
  const grouped: SampleMedia[] = []
  for (const root of roots) {
    grouped.push(root)
    const parts = partsBySource.get(root.id)
    if (parts) {
      grouped.push(...parts)
    }
  }
  return grouped
}
