/**
 * Blend between the hero and the content panel that floats ~10% up over the hero's bottom. Rendered as
 * the first (absolutely-positioned) child of the content <section> — which is pulled up with a negative
 * margin and relative z — so it sits in the band just above the section top, fading the hero image into
 * the panel's background instead of a hard edge. Non-interactive.
 */
export function HeroFade() {
    return <div className="pointer-events-none absolute inset-x-0 top-0 h-24 -translate-y-full bg-linear-to-b from-transparent to-background" />
}
