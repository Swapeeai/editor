"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

// Remembers the search words while you move between pages.
// A refresh starts over with an empty search.

type SearchContextValue = {
  query: string
  setQuery: (value: string) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("")

  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearchQuery() {
  const value = useContext(SearchContext)
  if (!value) {
    throw new Error("useSearchQuery must be used inside SearchProvider")
  }
  return value
}
