function stemOf(title: string) {
  return title.trim().replace(/\s+\d+$/u, "").trim()
}

function keyOf(title: string) {
  return title.trim().toLowerCase()
}

export function uniqueTitle(requested: string, taken: Iterable<string>) {
  const title = requested.trim()
  if (!title) {
    return title
  }
  const used = new Set([...taken].map(keyOf))
  if (!used.has(keyOf(title))) {
    return title
  }
  const stem = stemOf(title) || title
  let number = 1
  while (used.has(keyOf(`${stem} ${number}`))) {
    number += 1
  }
  return `${stem} ${number}`
}

export function patternTitles(pattern: string, count: number, takenOutside: Iterable<string>) {
  const stem = stemOf(pattern) || pattern.trim()
  const used = new Set([...takenOutside].map(keyOf))
  const titles: string[] = []
  let number = 1
  while (titles.length < count) {
    const candidate = `${stem} ${number}`
    number += 1
    if (used.has(keyOf(candidate))) {
      continue
    }
    used.add(keyOf(candidate))
    titles.push(candidate)
  }
  return titles
}
