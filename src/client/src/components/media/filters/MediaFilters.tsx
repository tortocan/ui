import { ChevronDownIcon } from "lucide-react"
import type { Genre, WatchProviderListItem } from "@lorenzopant/tmdb"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.tsx"

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
    providers: WatchProviderListItem[]
    providerIds: number[]
    onToggleProvider: (id: number) => void
    sortKey: SortKey
    onSortChange: (key: SortKey) => void
    fromYear: number | null
    onFromYear: (year: number | null) => void
    toYear: number | null
    onToYear: (year: number | null) => void
}

/**
 * Shared Discover-style filter bar: All Genres, All Providers, sort, From Year, To Year. Purely
 * presentational — the caller owns the state and decides what the filters act on (Discover → a TMDB
 * discover query; the library views → owned titles filtered client-side). Rendered as a fragment so
 * the caller controls the surrounding row (and can place a heading / extra controls alongside).
 */
export function MediaFilters({ genres, genreIds, onToggleGenre, providers, providerIds, onToggleProvider, sortKey, onSortChange, fromYear, onFromYear, toYear, onToYear }: MediaFiltersProps) {
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

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        {providerIds.length ? `Networks (${providerIds.length})` : "All Networks"}
                        <ChevronDownIcon className="size-4 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-y-auto">
                    {providers.map((provider) => (
                        <DropdownMenuCheckboxItem
                            key={provider.provider_id}
                            checked={providerIds.includes(provider.provider_id)}
                            onCheckedChange={() => onToggleProvider(provider.provider_id)}
                            onSelect={(e) => e.preventDefault()}
                        >
                            {provider.provider_name}
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
