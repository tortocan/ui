import { ChevronDownIcon } from "lucide-react"
import type { Genre } from "@lorenzopant/tmdb"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.tsx"
import { NETWORKS, STUDIOS } from "./catalog.ts"

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

export interface MediaFiltersProps {
    genres: Genre[]
    genreIds: number[]
    onToggleGenre: (id: number) => void
    // Networks are TMDB TV networks (TV only); hidden when showNetworks is false (e.g. on movies).
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
 * as a fragment so the caller controls the surrounding row (heading / extra controls alongside).
 */
export function MediaFilters({
    genres,
    genreIds,
    onToggleGenre,
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
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        {genreIds.length ? `Genres (${genreIds.length})` : "All Genres"}
                        <ChevronDownIcon className="size-4 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-y-auto">
                    {genres.map((genre) => (
                        <DropdownMenuCheckboxItem key={genre.id} checked={genreIds.includes(genre.id)} onCheckedChange={() => onToggleGenre(genre.id)} onSelect={(e) => e.preventDefault()}>
                            {genre.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {showNetworks && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            {networkIds.length ? `Networks (${networkIds.length})` : "All Networks"}
                            <ChevronDownIcon className="size-4 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-72 overflow-y-auto">
                        {NETWORKS.map((n) => (
                            <DropdownMenuCheckboxItem key={n.id} checked={networkIds.includes(n.id)} onCheckedChange={() => onToggleNetwork(n.id)} onSelect={(e) => e.preventDefault()}>
                                {n.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        {studioIds.length ? `Studios (${studioIds.length})` : "All Studios"}
                        <ChevronDownIcon className="size-4 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-y-auto">
                    {STUDIOS.map((s) => (
                        <DropdownMenuCheckboxItem key={s.id} checked={studioIds.includes(s.id)} onCheckedChange={() => onToggleStudio(s.id)} onSelect={(e) => e.preventDefault()}>
                            {s.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        {sortLabel}
                        <ChevronDownIcon className="size-4 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuRadioGroup value={sortKey} onValueChange={(value) => onSortChange(value as SortKey)}>
                        {SORT_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        {fromYear ?? "From Year"}
                        <ChevronDownIcon className="size-4 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuRadioGroup value={fromYear ? String(fromYear) : "any"} onValueChange={(value) => onFromYear(value === "any" ? null : Number(value))}>
                        <DropdownMenuRadioItem value="any">Any</DropdownMenuRadioItem>
                        {YEARS.map((year) => (
                            <DropdownMenuRadioItem key={year} value={String(year)}>
                                {year}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        {toYear ?? "To Year"}
                        <ChevronDownIcon className="size-4 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuRadioGroup value={toYear ? String(toYear) : "any"} onValueChange={(value) => onToYear(value === "any" ? null : Number(value))}>
                        <DropdownMenuRadioItem value="any">Any</DropdownMenuRadioItem>
                        {YEARS.map((year) => (
                            <DropdownMenuRadioItem key={year} value={String(year)}>
                                {year}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
