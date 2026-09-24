// Fake library so the pages are not empty.
// These are not Suzanne's real photos or videos.
// Each item belongs to exactly one project.

import type { ProjectId } from "@/lib/projects"

export type MediaType = "video" | "photo"

export type SampleMedia = {
  id: string
  projectId: ProjectId
  title: string
  mediaType: MediaType
  retreatName: string
  year: number
  location: string
  tags: string[]
  poster: string
  // Set for a real upload. Samples leave these out.
  fileName?: string
  playbackUrl?: string | null
}

const phuket = {
  projectId: "phuket" as const,
  retreatName: "Phuket Pole Retreat",
  year: 2026,
  location: "Phuket, Thailand",
}

const ibiza = {
  projectId: "ibiza" as const,
  retreatName: "Ibiza Pole Retreat",
  year: 2026,
  location: "Ibiza, Spain",
}

const flati = {
  projectId: "flati" as const,
  retreatName: "Flirty Fitness",
  year: 2026,
  location: "Flirty studio",
}

export const sampleMedia: SampleMedia[] = [
  {
    id: "phuket-sunset-beach",
    title: "Sample: Phuket beach at sunset",
    mediaType: "photo",
    ...phuket,
    tags: ["beach", "sunset"],
    poster: "/posters/phuket-sunset-beach.svg",
  },
  {
    id: "phuket-studio-deck",
    title: "Sample: Studio deck over the water",
    mediaType: "photo",
    ...phuket,
    tags: ["beach", "sunset"],
    poster: "/posters/phuket-studio-deck.svg",
  },
  {
    id: "phuket-pole-trick",
    title: "Sample: Dynamic pole trick",
    mediaType: "video",
    ...phuket,
    tags: ["dynamic pole trick"],
    poster: "/posters/phuket-pole-trick.svg",
  },
  {
    id: "phuket-clapping",
    title: "Sample: Students clapping",
    mediaType: "video",
    ...phuket,
    tags: ["clapping"],
    poster: "/posters/phuket-clapping.svg",
  },
  {
    id: "phuket-adam-teaching",
    title: "Sample: Adam teaching a spin",
    mediaType: "video",
    ...phuket,
    tags: ["teaching", "instructor"],
    poster: "/posters/phuket-adam-teaching.svg",
  },
  {
    id: "phuket-instructors",
    title: "Sample: Instructors together",
    mediaType: "photo",
    ...phuket,
    tags: ["instructor"],
    poster: "/posters/phuket-instructors.svg",
  },
  {
    id: "phuket-lunch",
    title: "Sample: Lunch on the deck",
    mediaType: "photo",
    ...phuket,
    tags: ["food"],
    poster: "/posters/phuket-lunch.svg",
  },
  {
    id: "phuket-laughing",
    title: "Sample: People laughing after class",
    mediaType: "video",
    ...phuket,
    tags: ["laughing"],
    poster: "/posters/phuket-laughing.svg",
  },
  {
    id: "phuket-group-hug",
    title: "Sample: Group hug after class",
    mediaType: "video",
    ...phuket,
    tags: ["group hug"],
    poster: "/posters/phuket-group-hug.svg",
  },
  {
    id: "ibiza-sunset",
    title: "Sample: Ibiza sunset",
    mediaType: "photo",
    ...ibiza,
    tags: ["sunset", "beach"],
    poster: "/posters/ibiza-sunset.svg",
  },
  {
    id: "ibiza-beach",
    title: "Sample: Ibiza beach walk",
    mediaType: "photo",
    ...ibiza,
    tags: ["beach"],
    poster: "/posters/ibiza-beach.svg",
  },
  {
    id: "ibiza-pole-trick",
    title: "Sample: Dynamic pole trick in Ibiza",
    mediaType: "video",
    ...ibiza,
    tags: ["dynamic pole trick"],
    poster: "/posters/ibiza-pole-trick.svg",
  },
  {
    id: "ibiza-clapping",
    title: "Sample: Students clapping in Ibiza",
    mediaType: "video",
    ...ibiza,
    tags: ["clapping"],
    poster: "/posters/ibiza-clapping.svg",
  },
  {
    id: "ibiza-teaching",
    title: "Sample: Maya teaching a climb",
    mediaType: "video",
    ...ibiza,
    tags: ["teaching", "instructor"],
    poster: "/posters/ibiza-teaching.svg",
  },
  {
    id: "ibiza-instructors",
    title: "Sample: Ibiza instructors together",
    mediaType: "photo",
    ...ibiza,
    tags: ["instructor"],
    poster: "/posters/ibiza-instructors.svg",
  },
  {
    id: "ibiza-dinner",
    title: "Sample: Dinner in Ibiza",
    mediaType: "photo",
    ...ibiza,
    tags: ["food"],
    poster: "/posters/ibiza-dinner.svg",
  },
  {
    id: "ibiza-laughing",
    title: "Sample: People laughing in Ibiza",
    mediaType: "video",
    ...ibiza,
    tags: ["laughing"],
    poster: "/posters/ibiza-laughing.svg",
  },
  {
    id: "ibiza-group-hug",
    title: "Sample: Group hug in Ibiza",
    mediaType: "video",
    ...ibiza,
    tags: ["group hug"],
    poster: "/posters/ibiza-group-hug.svg",
  },
  {
    id: "flati-studio",
    title: "Sample: Flirty studio floor",
    mediaType: "photo",
    ...flati,
    tags: ["studio"],
    poster: "/posters/flati-studio.svg",
  },
  {
    id: "flati-clapping",
    title: "Sample: Class clapping",
    mediaType: "video",
    ...flati,
    tags: ["clapping"],
    poster: "/posters/flati-clapping.svg",
  },
  {
    id: "flati-teaching",
    title: "Sample: Coach teaching a squat",
    mediaType: "video",
    ...flati,
    tags: ["teaching", "instructor"],
    poster: "/posters/flati-teaching.svg",
  },
  {
    id: "flati-trainers",
    title: "Sample: Trainers together",
    mediaType: "photo",
    ...flati,
    tags: ["instructor"],
    poster: "/posters/flati-trainers.svg",
  },
  {
    id: "flati-snacks",
    title: "Sample: Snack table",
    mediaType: "photo",
    ...flati,
    tags: ["food"],
    poster: "/posters/flati-snacks.svg",
  },
  {
    id: "flati-laughing",
    title: "Sample: Laughing between sets",
    mediaType: "video",
    ...flati,
    tags: ["laughing"],
    poster: "/posters/flati-laughing.svg",
  },
  {
    id: "flati-stretch",
    title: "Sample: Stretching before class",
    mediaType: "video",
    ...flati,
    tags: ["teaching"],
    poster: "/posters/flati-stretch.svg",
  },
]

export type MediaFilter = "all" | MediaType

export function mediaForProject(projectId: ProjectId) {
  return sampleMedia.filter((item) => item.projectId === projectId)
}

export function filterMediaList(
  items: SampleMedia[],
  query: string,
  mediaFilter: MediaFilter = "all",
) {
  const needle = query.trim().toLowerCase()

  return items.filter((item) => {
    if (mediaFilter !== "all" && item.mediaType !== mediaFilter) {
      return false
    }
    if (!needle) {
      return true
    }

    const haystack = [
      item.title,
      item.retreatName,
      String(item.year),
      item.location,
      item.fileName ?? "",
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(needle)
  })
}

export function filterSampleMedia(
  query: string,
  projectId: ProjectId,
  mediaFilter: MediaFilter = "all",
) {
  return filterMediaList(mediaForProject(projectId), query, mediaFilter)
}
