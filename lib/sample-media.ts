// Fake library so the pages are not empty.
// These are not Suzanne's real photos or videos.

export type MediaType = "video" | "photo"

export type SampleMedia = {
  id: string
  title: string
  mediaType: MediaType
  retreatName: string
  year: number
  // True for the camp she is working on now. False for an older camp.
  isCurrent: boolean
  location: string
  tags: string[]
  poster: string
}

const phuket = {
  retreatName: "Phuket Pole Camp",
  year: 2026,
  isCurrent: true,
  location: "Phuket, Thailand",
}

const bali = {
  retreatName: "Bali Pole Retreat",
  year: 2025,
  isCurrent: false,
  location: "Canggu, Bali",
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
    id: "phuket-fruit",
    title: "Sample: Fruit and coffee table",
    mediaType: "photo",
    ...phuket,
    tags: ["food"],
    poster: "/posters/phuket-fruit.svg",
  },
  {
    id: "phuket-warm-up",
    title: "Sample: Morning stretch in the studio",
    mediaType: "video",
    ...phuket,
    tags: ["teaching"],
    poster: "/posters/phuket-warm-up.svg",
  },
  {
    id: "bali-golden-hour",
    title: "Sample: Bali studio at golden hour",
    mediaType: "photo",
    ...bali,
    tags: ["sunset"],
    poster: "/posters/bali-golden-hour.svg",
  },
  {
    id: "bali-beach-walk",
    title: "Sample: Beach walk before class",
    mediaType: "photo",
    ...bali,
    tags: ["beach"],
    poster: "/posters/bali-beach-walk.svg",
  },
  {
    id: "bali-pole-trick",
    title: "Sample: Dynamic pole trick on the sand",
    mediaType: "video",
    ...bali,
    tags: ["dynamic pole trick"],
    poster: "/posters/bali-pole-trick.svg",
  },
  {
    id: "bali-clapping",
    title: "Sample: Students clapping on the last day",
    mediaType: "video",
    ...bali,
    tags: ["clapping"],
    poster: "/posters/bali-clapping.svg",
  },
  {
    id: "bali-maya-teaching",
    title: "Sample: Maya teaching a climb",
    mediaType: "video",
    ...bali,
    tags: ["teaching", "instructor"],
    poster: "/posters/bali-maya-teaching.svg",
  },
  {
    id: "bali-instructors",
    title: "Sample: Instructors lining up",
    mediaType: "photo",
    ...bali,
    tags: ["instructor"],
    poster: "/posters/bali-instructors.svg",
  },
  {
    id: "bali-dinner",
    title: "Sample: Dinner under the lights",
    mediaType: "photo",
    ...bali,
    tags: ["food"],
    poster: "/posters/bali-dinner.svg",
  },
  {
    id: "bali-laughing",
    title: "Sample: People laughing at dinner",
    mediaType: "video",
    ...bali,
    tags: ["laughing"],
    poster: "/posters/bali-laughing.svg",
  },
  {
    id: "bali-group-hug",
    title: "Sample: Group hug on the last night",
    mediaType: "video",
    ...bali,
    tags: ["group hug"],
    poster: "/posters/bali-group-hug.svg",
  },
  {
    id: "bali-breakfast",
    title: "Sample: Breakfast fruit plates",
    mediaType: "photo",
    ...bali,
    tags: ["food"],
    poster: "/posters/bali-breakfast.svg",
  },
  {
    id: "bali-drills-laugh",
    title: "Sample: Laughing between drills",
    mediaType: "video",
    ...bali,
    tags: ["laughing"],
    poster: "/posters/bali-drills-laugh.svg",
  },
]

export type MediaFilter = "all" | MediaType

export function filterSampleMedia(query: string, mediaFilter: MediaFilter = "all") {
  const needle = query.trim().toLowerCase()

  return sampleMedia.filter((item) => {
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
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(needle)
  })
}
