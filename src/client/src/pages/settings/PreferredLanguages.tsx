import { useState } from "react"
import { GripVertical, Lock, Plus, X } from "lucide-react"
import { useAppSettings, supportedLocales, type SupportedLocales } from "@/hooks/use-appsettings"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const labelOf = (iso: SupportedLocales) => supportedLocales.find((l) => l.iso639 === iso)?.label ?? iso

/**
 * A per-profile, drag-to-reorder list of PREFERRED search languages. The profile's own language is
 * always searched first (shown pinned + locked at the top); below it is the ordered list of extra
 * languages (stored in `searchLocales`), which the user reorders by dragging and extends via the
 * "Add a language" picker. Search runs one query per language in this order and merges — so the order
 * is the priority (earlier languages win the displayed title). Native HTML5 DnD, no dependency.
 */
export function PreferredLanguages() {
    const { locale, searchLocales, setSearchLocales } = useAppSettings()
    const [dragIndex, setDragIndex] = useState<number | null>(null)
    const [overIndex, setOverIndex] = useState<number | null>(null)

    const available = supportedLocales.filter((l) => l.iso639 !== locale && !searchLocales.includes(l.iso639))

    const move = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= searchLocales.length || to >= searchLocales.length) return
        const next = [...searchLocales]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        setSearchLocales(next)
    }
    const add = (iso: SupportedLocales) => setSearchLocales([...searchLocales, iso])
    const remove = (iso: SupportedLocales) => setSearchLocales(searchLocales.filter((x) => x !== iso))

    const row = "flex items-center gap-2 rounded-lg border bg-card px-3 py-2"

    return (
        <div className="space-y-3">
            {/* Profile language — always searched first, pinned. */}
            <div className={cn(row, "border-dashed opacity-80")}>
                <Lock className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{labelOf(locale)}</span>
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Your language · 1st</span>
            </div>

            {/* Extra preferred languages, drag to reorder. */}
            {searchLocales.map((iso, i) => (
                <div
                    key={iso}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => {
                        e.preventDefault()
                        if (overIndex !== i) setOverIndex(i)
                    }}
                    onDrop={() => {
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
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground tabular-nums">{i + 2}</span>
                    <button type="button" onClick={() => remove(iso)} aria-label={`Remove ${labelOf(iso)}`} className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <X className="size-4" />
                    </button>
                </div>
            ))}

            {available.length > 0 && (
                <Select value="" onValueChange={(v) => add(v as SupportedLocales)}>
                    <SelectTrigger className="w-full">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <Plus className="size-4" />
                            Add a language
                        </span>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {[...available]
                                .sort((a, b) => a.label.localeCompare(b.label))
                                .map((l) => (
                                    <SelectItem key={l.iso639} value={l.iso639}>
                                        {l.label}
                                    </SelectItem>
                                ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            )}
        </div>
    )
}
