// The three libraries Suzanne keeps in this app.
// Each sample photo or video belongs to exactly one of these.

export const projects = [
  {
    id: "ibiza",
    name: "Ibiza Pro Retreat",
    blurb: "Pole retreat samples set in Ibiza.",
  },
  {
    id: "phuket",
    name: "Phuket Pro Retreat",
    blurb: "Pole retreat samples set in Phuket.",
  },
  {
    id: "flati",
    name: "Flati Fitness",
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
