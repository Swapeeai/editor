// Fake library cards so the Media Library is not empty.
// These are not real retreat videos.

export type SampleVideo = {
  id: string
  title: string
  poster: string
}

export const sampleVideos: SampleVideo[] = [
  {
    id: "people-laughing",
    title: "Sample: People laughing",
    poster: "/posters/people-laughing.svg",
  },
  {
    id: "students-clapping",
    title: "Sample: Students clapping",
    poster: "/posters/students-clapping.svg",
  },
  {
    id: "adam-teaching",
    title: "Sample: Adam teaching",
    poster: "/posters/adam-teaching.svg",
  },
  {
    id: "group-hugging",
    title: "Sample: Group hugging",
    poster: "/posters/group-hugging.svg",
  },
  {
    id: "dynamic-pole-trick",
    title: "Sample: Dynamic pole trick",
    poster: "/posters/dynamic-pole-trick.svg",
  },
]

export function filterSampleVideos(query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return sampleVideos
  }

  return sampleVideos.filter((video) =>
    video.title.toLowerCase().includes(needle),
  )
}
