// Shared rail slide sizing. The item `pl-*` padding and the track's negative `-ml-*` gutter must stay
// paired (Embla's trailing `last:mr-*` inset trick depends on it), so they live together here — one
// edit changes every standard poster rail instead of the 3 copies this used to be.
export const RAIL_ITEM_CLASS = "basis-1/2 pl-2 sm:basis-1/3 md:basis-1/4 md:pl-4 lg:basis-1/5 xl:basis-1/7 last:mr-4 md:last:mr-6"
export const RAIL_CONTENT_CLASS = "-ml-2 md:-ml-4"
