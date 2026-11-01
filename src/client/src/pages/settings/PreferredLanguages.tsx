import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, GripVertical, Lock, Plus, X } from "lucide-react"
import { useAppSettings, supportedLocales } from "@/hooks/use-appsettings"
import { useTmdbLanguages, type TmdbLanguage } from "@/hooks/use-tmdb-languages"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

/**
 * A per-profile, reorderable list of PREFERRED search languages. The profile's own language is always
 * searched first (pinned + locked); below it is the ordered list of extra languages (`searchLocales`),
 * which the user reorders and extends. Search runs one query per language in this order and merges — so
 * the order is the priority (earlier languages win the displayed title).
 *
 * The "Add a language" control is a searchable combobox listing EVERY TMDB language (iso-639-1 from
 * TMDB's configuration), by English name (native names are unreliable — some render as "?????").
 *
 * Reordering works three ways so it's available everywhere: native HTML5 drag-and-drop (desktop mouse)
 * and up/down buttons (touch + keyboard). The working list excludes the profile locale, so writing it
 * back also prunes any stale duplicate of the profile language.
 */
export function PreferredLanguages() {
    const { locale, searchLocales, setSearchLocales } = useAppSettings()
    const { languages: tmdbLangs, labelOf } = useTmdbLanguages()
    const [dragIndex, setDragIndex] = useState<number | null>(null)
    const [overIndex, setOverIndex] = useState<number | null>(null)
    const [pickerOpen, setPickerOpen] = useState(false)

    // The profile's own language is implicit (pinned first) — never a draggable item.
    const items = useMemo(() => searchLocales.filter((l) => l !== locale), [searchLocales, locale])

    // All TMDB languages not already chosen and not the profile's, sorted by English name. Falls back to
    // the UI locales before the TMDB list loads so the picker is never empty.
    const available = useMemo<TmdbLanguage[]>(() => {
        const source: TmdbLanguage[] = tmdbLangs.length ? tmdbLangs : supportedLocales.map((l) => ({ code: l.iso639, label: l.label }))
        return source.filter((l) => l.code !== locale && !items.includes(l.code)).sort((a, b) => a.label.localeCompare(b.label))
    }, [tmdbLangs, locale, items])

    const move = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return
        const next = [...items]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        setSearchLocales(next)
    }
    const add = (code: string) => {
        setSearchLocales([...items, code])
        setPickerOpen(false)
    }
    const remove = (code: string) => setSearchLocales(items.filter((x) => x !== code))

    const row = "flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
    const iconBtn = "rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"

    return (
        <div className="space-y-2">
            {/* Profile language — always searched first, pinned. */}
            <div className={cn(row, "border-dashed opacity-80")}>
                <Lock className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{labelOf(locale)}</span>
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Your language · 1st</span>
            </div>

            {/* Extra preferred languages — drag (desktop) or the up/down buttons (touch/keyboard) to reorder. */}
            {items.map((code, i) => (
                <div
                    key={code}
                    draggable
                    onDragStart={(e) => {
                        setDragIndex(i)
                        e.dataTransfer.effectAllowed = "move"
                        // Firefox requires a setData call inside dragstart or the drag never begins.
                        e.dataTransfer.setData("text/plain", String(i))
                    }}
                    onDragOver={(e) => {
                        e.preventDefault()
                        if (overIndex !== i) setOverIndex(i)
                    }}
                    onDrop={(e) => {
                        e.preventDefault()
                        if (dragIndex !== null) move(dragIndex, i)
                        setDragIndex(null)
                        setOverIndex(null)
                    }}
                    onDragEnd={() => {
                        setDragIndex(null)
                        setOverIndex(null)
                    }}
                    className={cn(row, "cursor-grab active:cursor-grabbing", dragIndex === i && "opacity-50", overIndex === i && dragIndex !== i && "border-primary")}
                >
                    <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">{labelOf(code)}</span>
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{i + 2}</span>
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${labelOf(code)} up`} className={iconBtn}>
                        <ChevronUp className="size-4" />
                    </button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${labelOf(code)} down`} className={iconBtn}>
                        <ChevronDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => remove(code)} aria-label={`Remove ${labelOf(code)}`} className={iconBtn}>
                        <X className="size-4" />
                    </button>
                </div>
            ))}

            {available.length > 0 && (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                        <button type="button" className={cn(row, "w-full justify-start text-muted-foreground transition-colors hover:bg-muted")}>
                            <Plus className="size-4" />
                            <span className="text-sm font-medium">Add a language</span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
                        <Command>
                            <CommandInput placeholder="Search languages…" />
                            <CommandList className="max-h-72">
                                <CommandEmpty>No language found.</CommandEmpty>
                                {available.map((l) => (
                                    // English name only — some TMDB native names are empty/unrenderable ("?????").
                                    <CommandItem key={l.code} value={`${l.label} ${l.native ?? ""} ${l.code}`} onSelect={() => add(l.code)}>
                                        {l.label}
                                    </CommandItem>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    )
}
