// The three libraries Suzanne keeps in this app.
// Each sample photo or video belongs to exactly one of these.

export const projects = [
  {
    id: "ibiza",
    name: "Ibiza Pole Retreat",
    blurb: "Pole retreat samples set in Ibiza.",
  },
  {
    id: "phuket",
    name: "Phuket Pole Retreat",
    blurb: "Pole retreat samples set in Phuket.",
  },
  {
    id: "flati",
    name: "Flirty Fitness",
    blurb: "Fitness and studio samples.",
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
