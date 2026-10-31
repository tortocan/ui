import { useLocation, useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card.tsx"
import { cn } from "@/lib/utils.ts"

export interface SeeMoreCardProps {
    /** Route to open when clicked — e.g. "/movies" or "/shows" (the full browse pages). */
    href: string
    label?: string
    className?: string
}

/**
 * Trailing "See more" card shown at the end of a rail. Matches MediaCard's poster shape so it reads
 * as the last tile, but instead of opening the drawer it navigates to the full browse page (the same
 * UI as the Movies / TV Shows nav entries). Kept generic so every typed rail reuses one component.
 */
export function SeeMoreCard({ href, label = "See more", className }: SeeMoreCardProps) {
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const go = () => navigate(href)

    // Don't show a "See more" that just points back to the page we're already on (the Movies / TV
    // Shows pages reuse these rails), so the trailing card only appears where it goes somewhere new.
    if (pathname === href) return null

    return (
        <Card
            className={cn("group h-full cursor-pointer overflow-hidden border-none py-0 transition-all", className)}
            role="button"
            tabIndex={0}
            onClick={go}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    go()
                }
            }}
        >
            <CardContent className="p-0">
                <div className="relative flex aspect-2/3 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-white/15 bg-muted text-white/80 transition-colors group-hover:bg-muted/70 group-hover:text-white">
                    <div className="flex size-12 items-center justify-center rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110">
                        <ArrowRight className="size-6" />
                    </div>
                    <span className="text-sm font-semibold">{label}</span>
                </div>
            </CardContent>
        </Card>
    )
}
