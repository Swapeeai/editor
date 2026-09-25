// The three libraries Suzanne keeps in this app.
// Stored ids stay ibiza, phuket, and flati so existing uploads keep working.

export const projects = [
  {
    id: "ibiza",
    name: "Ibiza Pole Retreat",
    blurb: "Ibiza pole retreat.",
  },
  {
    id: "phuket",
    name: "Phuket Pole Retreat",
    blurb: "Phuket pole retreat.",
  },
  {
    id: "flati",
    name: "Flirty Fitness",
    blurb: "Flirty Fitness classes.",
  },
] as const

export type ProjectId = (typeof projects)[number]["id"]

export function isProjectId(value: string | null | undefined): value is ProjectId {
  return projects.some((project) => project.id === value)
}

export function projectById(id: ProjectId) {
  const project = projects.find((item) => item.id === id)
  return project ?? projects[0]
}
