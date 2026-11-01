import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, GripVertical, Lock, Plus, X } from "lucide-react"
import { useAppSettings, supportedLocales, type SupportedLocales } from "@/hooks/use-appsettings"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const labelOf = (iso: SupportedLocales) => supportedLocales.find((l) => l.iso639 === iso)?.label ?? iso

/**
 * A per-profile, reorderable list of PREFERRED search languages. The profile's own language is always
 * searched first (shown pinned + locked at the top); below it is the ordered list of extra languages
 * (stored in `searchLocales`), which the user reorders and extends. Search runs one query per language
 * in this order and merges — so the order is the priority (earlier languages win the displayed title).
 *
 * Reordering works three ways so it's available everywhere: native HTML5 drag-and-drop (desktop mouse),
 * and up/down buttons (touch + keyboard, since HTML5 DnD doesn't fire on touch). The working list
 * excludes the profile locale, so writing it back also prunes any stale duplicate of the profile
 * language (e.g. if the user later switches their profile language to one already in the list).
 */
export function PreferredLanguages() {
    const { locale, searchLocales, setSearchLocales } = useAppSettings()
    const [dragIndex, setDragIndex] = useState<number | null>(null)
    const [overIndex, setOverIndex] = useState<number | null>(null)

    // The profile's own language is implicit (pinned first) — never a draggable item.
    const items = useMemo(() => searchLocales.filter((l) => l !== locale), [searchLocales, locale])
    const available = supportedLocales.filter((l) => l.iso639 !== locale && !items.includes(l.iso639))

    const move = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return
        const next = [...items]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        setSearchLocales(next)
    }
    const add = (iso: SupportedLocales) => setSearchLocales([...items, iso])
    const remove = (iso: SupportedLocales) => setSearchLocales(items.filter((x) => x !== iso))

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
            {items.map((iso, i) => (
                <div
                    key={iso}
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
                    <span className="flex-1 text-sm font-medium">{labelOf(iso)}</span>
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{i + 2}</span>
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${labelOf(iso)} up`} className={iconBtn}>
                        <ChevronUp className="size-4" />
                    </button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${labelOf(iso)} down`} className={iconBtn}>
                        <ChevronDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => remove(iso)} aria-label={`Remove ${labelOf(iso)}`} className={iconBtn}>
                        <X className="size-4" />
                    </button>
                </div>
            ))}

            {available.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button type="button" className={cn(row, "w-full justify-start text-muted-foreground transition-colors hover:bg-muted")}>
                            <Plus className="size-4" />
                            <span className="text-sm font-medium">Add a language</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-72 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto">
                        {[...available]
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((l) => (
                                <DropdownMenuItem key={l.iso639} onClick={() => add(l.iso639)}>
                                    {l.label}
                                </DropdownMenuItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
