import type { Genre } from "@lorenzopant/tmdb"
import { MultiSelectFilter, SingleSelectFilter } from "./FilterDropdowns.tsx"
import { STUDIOS, type CatalogEntry } from "./catalog.ts"

export type SortKey = "popularity" | "rating" | "newest" | "oldest" | "az"

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "popularity", label: "Most Popular" },
    { value: "rating", label: "Top Rated" },
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "az", label: "A-Z" },
]

const CURRENT_YEAR = new Date().getFullYear()
export const YEARS = Array.from({ length: CURRENT_YEAR - 1950 + 1 }, (_, i) => CURRENT_YEAR - i)
const YEAR_OPTIONS = [{ value: "any", label: "Any" }, ...YEARS.map((y) => ({ value: String(y), label: String(y) }))]

export interface MediaFiltersProps {
    genres: Genre[]
    genreIds: number[]
    onToggleGenre: (id: number) => void
    // Networks list to show: TMDB TV networks on TV, streaming providers on movies (caller decides).
    networkItems: CatalogEntry[]
    networkIds: number[]
    onToggleNetwork: (id: number) => void
    showNetworks?: boolean
    // Studios are TMDB production companies (movies & TV).
    studioIds: number[]
    onToggleStudio: (id: number) => void
    sortKey: SortKey
    onSortChange: (key: SortKey) => void
    fromYear: number | null
    onFromYear: (year: number | null) => void
    toYear: number | null
    onToYear: (year: number | null) => void
}

/**
 * Shared filter bar: Genres, Networks (curated TMDB TV networks — hidden on movies), Studios (curated
 * TMDB production companies), sort, From/To Year. Presentational: the caller owns the state and decides
 * what the filters act on (Discover → a TMDB query; the library → owned titles client-side). Rendered
 * as a fragment so the caller controls the surrounding row. Each dropdown is a shared MultiSelectFilter
 * or SingleSelectFilter (see FilterDropdowns) so there's no per-filter markup duplication.
 */
export function MediaFilters({
    genres,
    genreIds,
    onToggleGenre,
    networkItems,
    networkIds,
    onToggleNetwork,
    showNetworks = true,
    studioIds,
    onToggleStudio,
    sortKey,
    onSortChange,
    fromYear,
    onFromYear,
    toYear,
    onToYear,
}: MediaFiltersProps) {
    const sortLabel = SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? "Most Popular"

    return (
        <>
            <MultiSelectFilter allLabel="All Genres" nounLabel="Genres" items={genres} selected={genreIds} onToggle={onToggleGenre} />
            {showNetworks && <MultiSelectFilter allLabel="All Networks" nounLabel="Networks" items={networkItems} selected={networkIds} onToggle={onToggleNetwork} />}
            <MultiSelectFilter allLabel="All Studios" nounLabel="Studios" items={STUDIOS} selected={studioIds} onToggle={onToggleStudio} />
            <SingleSelectFilter triggerLabel={sortLabel} value={sortKey} options={SORT_OPTIONS} onChange={(v) => onSortChange(v as SortKey)} />
            <SingleSelectFilter
                scrollable
                triggerLabel={fromYear ?? "From Year"}
                value={fromYear ? String(fromYear) : "any"}
                options={YEAR_OPTIONS}
                onChange={(v) => onFromYear(v === "any" ? null : Number(v))}
            />
            <SingleSelectFilter
                scrollable
                triggerLabel={toYear ?? "To Year"}
                value={toYear ? String(toYear) : "any"}
                options={YEAR_OPTIONS}
                onChange={(v) => onToYear(v === "any" ? null : Number(v))}
            />
        </>
    )
}
