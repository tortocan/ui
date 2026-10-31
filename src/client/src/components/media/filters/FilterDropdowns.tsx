import type { ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.tsx"

/** Outline button trigger with the chevron, shared by both dropdown kinds. */
function Trigger({ children }: { children: ReactNode }) {
    return (
        <DropdownMenuTrigger asChild>
            <Button variant="outline">
                {children}
                <ChevronDownIcon className="size-4 opacity-60" />
            </Button>
        </DropdownMenuTrigger>
    )
}

/** Multi-select checkbox dropdown (Genres / Networks / Studios). */
export function MultiSelectFilter({
    allLabel,
    nounLabel,
    items,
    selected,
    onToggle,
}: {
    allLabel: string
    nounLabel: string
    items: { id: number; name: string }[]
    selected: number[]
    onToggle: (id: number) => void
}) {
    return (
        <DropdownMenu>
            <Trigger>{selected.length ? `${nounLabel} (${selected.length})` : allLabel}</Trigger>
            <DropdownMenuContent className="max-h-72 overflow-y-auto">
                {items.map((it) => (
                    <DropdownMenuCheckboxItem key={it.id} checked={selected.includes(it.id)} onCheckedChange={() => onToggle(it.id)} onSelect={(e) => e.preventDefault()}>
                        {it.name}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/** Single-select radio dropdown (Sort / From Year / To Year). */
export function SingleSelectFilter({
    triggerLabel,
    value,
    options,
    onChange,
    scrollable,
}: {
    triggerLabel: ReactNode
    value: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
    scrollable?: boolean
}) {
    return (
        <DropdownMenu>
            <Trigger>{triggerLabel}</Trigger>
            <DropdownMenuContent className={scrollable ? "max-h-72 overflow-y-auto" : undefined}>
                <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
                    {options.map((o) => (
                        <DropdownMenuRadioItem key={o.value} value={o.value}>
                            {o.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
