import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

import { useAppSettings } from "@/hooks/use-appsettings.ts"
import { profileScopedKey } from "@/hooks/use-localstorage"
import { supportedLocales, type SupportedLocales } from "@/hooks/use-appsettings"
import { supportedRegions, useTmdb } from "@/hooks/use-tmdb.ts"
import { useOmss } from "@/hooks/use-omss.ts"
import { useHistory } from "@/hooks/use-history.ts"
import { useScrobbleHistory } from "@/hooks/use-scrobble-history.ts"
import { useFollows } from "@/hooks/use-follows.ts"
import { useMediaDrawer } from "@/components/media/drawer/hooks/useMediaDrawer.ts"

import type { CountryISO3166_1 } from "@lorenzopant/tmdb"

import { maskKey } from "@/lib/strings.utils.ts"

import { Badge } from "@/components/ui/badge.tsx"
import { Item, ItemContent, ItemHeader } from "@/components/ui/item.tsx"
import { H1, H4, P } from "@/components/ui/typography.tsx"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

import ConfirmDialog from "@/components/layout/ConfirmDialog.tsx"
import { ProfileSettings } from "@/pages/settings/ProfileSettings.tsx"
import { PreferredLanguages } from "@/pages/settings/PreferredLanguages.tsx"

import { AlertTriangle, Monitor, Moon, RefreshCcw, Star, Sun, Trash2 } from "lucide-react"
import { useEffect } from "react"
import i18n from "i18next"
import { useTheme } from "@/app/providers/theme-provider"
import { useColorTheme } from "@/hooks/use-color-theme"
import { colorThemes } from "@/hooks/use-color-theme"
import { cn } from "@/lib/utils"

export default function Settings() {
    const { t } = useTranslation(["settings", "common", "header"])
    const navigate = useNavigate()

    const [searchParams, setSearchParams] = useSearchParams()

    const validTabs = ["general", "profile", "appearance", "history", "scrobbler", "following", "playback", "omss", "tmdb"] as const

    type Tab = (typeof validTabs)[number]

    const tabFromUrl = searchParams.get("tab")

    const currentTab: Tab = validTabs.includes(tabFromUrl as Tab) ? (tabFromUrl as Tab) : "general"

    useEffect(() => {
        // if no tab is specified in the URL, redirect to the first tab
        if (!tabFromUrl) {
            navigate({ pathname: location.pathname, search: `?tab=${validTabs[0]}` }, { replace: true })
        }
    }, [])

    const { theme, setTheme } = useTheme()
    const { colorTheme, setColorTheme } = useColorTheme()

    const {
        region, locale, autoplayNext, tmdbApiKey, libraryOnly, showHeaderIcons, showHeaderLogo, showCarouselDots, showFooter,
        subtitleFontSize, subtitleColor, subtitleBackground, subtitlePosition, preferOriginalContent,
        setLocale, setAutoplayNext, setRegion, setLibraryOnly, setShowHeaderIcons, setShowHeaderLogo, setShowCarouselDots, setShowFooter,
        setSubtitleFontSize, setSubtitleColor, setSubtitleBackground, setSubtitlePosition, setPreferOriginalContent, standalone,
    } = useAppSettings()
    const tmdb = useTmdb()

    const handleLanguageChange = (value: string) => {
        setLocale(value as SupportedLocales)
        // set i18n
        i18n.changeLanguage(value).catch((err) => {
            console.error("Failed to change language:", err)
        })
        // tmdb cache
        tmdb.cache?.clear()
        // Persist synchronously: setLocale writes via a passive effect that the synchronous reload below
        // can preempt, dropping the change so the UI reverts to the old language after reload.
        try {
            localStorage.setItem(profileScopedKey("app.locale"), JSON.stringify(value))
        } catch {
            /* ignore storage failures */
        }
        location.reload()
    }

    const { valid, baseUrl, setBaseUrl } = useOmss()
    const { clear, history, remove } = useHistory()
    const { items: scrobbleItems, loading: scrobbleLoading, clear: scrobbleClear, remove: scrobbleRemove } = useScrobbleHistory()
    const { follows, loading: followsLoading, unfollow: followUnfollow, clear: followClear } = useFollows()
    const { open: openMedia } = useMediaDrawer()
    const { cache } = useTmdb()

    return (
        <section className="mx-auto mt-25 min-h-[60vh] max-w-3xl space-y-6 px-4 sm:px-6">
            <H1>{t("title")}</H1>

            <Tabs
                value={currentTab}
                onValueChange={(value) => {
                    const params = new URLSearchParams(searchParams)

                    if (value === "general") {
                        params.delete("tab")
                    } else {
                        params.set("tab", value)
                    }

                    setSearchParams(params, {
                        replace: true,
                    })
                }}
                className="w-full px-3"
            >
                {/* Tabs header */}
                <TabsList variant="line">
                    <TabsTrigger value="general">{t("general.title")}</TabsTrigger>
                    <TabsTrigger value="profile">{t("tabs.profile", "Profile")}</TabsTrigger>
                    <TabsTrigger value="appearance">{t("tabs.appearance")}</TabsTrigger>
                    <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
                    <TabsTrigger value="scrobbler">{t("tabs.scrobbler", "Scrobbler")}</TabsTrigger>
                    <TabsTrigger value="following">{t("tabs.following", "Following")}</TabsTrigger>
                    <TabsTrigger value="playback">{t("tabs.playback")}</TabsTrigger>
                    <TabsTrigger value="omss">{t("tabs.omss")}</TabsTrigger>
                    <TabsTrigger value="tmdb">{t("tabs.tmdb")}</TabsTrigger>
                </TabsList>

                {/* ---------------- GENERAL ---------------- */}
                <TabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("general.title")}</CardTitle>
                            <CardDescription>{t("general.description")}</CardDescription>
                            <CardAction>
                                <Button asChild>
                                    <Link to={t("common:opensource.git-url")} target="_blank" rel="noopener noreferrer">
                                        <Star />
                                        <span className="ml-1 hidden sm:inline">
                                            {t("header:githubButton", {
                                                platform: t("common:opensource.git-platform"),
                                            })}
                                        </span>
                                    </Link>
                                </Button>
                            </CardAction>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="mt-3 flex justify-between">
                                <div>
                                    <Label>{t("general.language.cardlabel")}</Label>
                                    <span className="flex pt-1 text-muted-foreground">{t("general.language.info", { gitUrl: t("common:opensource.git-url") })}</span>
                                    <span className="flex pt-1 font-semibold text-muted-foreground">
                                        Translations for languages other than English were generated with AI assistance and may contain inaccuracies. If you want to contribute a better translation for
                                        your language, please visit the url above.
                                    </span>
                                </div>

                                <Select value={locale} onValueChange={(value) => handleLanguageChange(value)}>
                                    <SelectTrigger className="max-w-min">
                                        <SelectValue placeholder={t("general.language.placeholder")} />
                                    </SelectTrigger>

                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>{t("general.language.selectlabel")}</SelectLabel>
                                            {[...supportedLocales]
                                                .sort((a, b) => a.label.localeCompare(b.label))
                                                .map((l) => (
                                                    <SelectItem key={l.iso639} value={l.iso639}>
                                                        {l.label}
                                                    </SelectItem>
                                                ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="mt-3 flex justify-between">
                                <div>
                                    <Label>{t("general.reset.label")}</Label>
                                    <span className="flex pt-1 text-muted-foreground">{t("general.reset.info")}</span>
                                </div>
                                <ConfirmDialog
                                    title={t("general.reset.title")}
                                    description={t("general.reset.description")}
                                    onConfirm={() => {
                                        localStorage.clear()
                                        location.reload()
                                    }}
                                    trigger={
                                        <Button variant="destructive" className={"max-w-min"}>
                                            <RefreshCcw />
                                            <span className={"ml-1 hidden sm:inline"}>{t("general.reset.button")}</span>
                                        </Button>
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- PROFILE ---------------- */}
                <TabsContent value="profile">
                    <ProfileSettings />
                </TabsContent>

                {/* ---------------- APPEARANCE ---------------- */}
                <TabsContent value="appearance">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("appearance.title")}</CardTitle>
                            <CardDescription>{t("appearance.description")}</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-8">
                            {/* Light / Dark / System */}
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label>{t("appearance.theme.label")}</Label>
                                    <p className="pt-1 text-sm text-muted-foreground">{t("appearance.theme.info")}</p>
                                </div>

                                <div className="flex shrink-0 gap-1 rounded-lg border p-1">
                                    <button
                                        type="button"
                                        onClick={() => setTheme("light")}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-all",
                                            theme === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Sun className="size-4" />
                                        <span className="hidden sm:inline">{t("appearance.theme.light")}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTheme("dark")}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-all",
                                            theme === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Moon className="size-4" />
                                        <span className="hidden sm:inline">{t("appearance.theme.dark")}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTheme("system")}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-all",
                                            theme === "system" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Monitor className="size-4" />
                                        <span className="hidden sm:inline">{t("appearance.theme.system")}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Color theme swatches */}
                            <div>
                                <Label>{t("appearance.colorTheme.label")}</Label>
                                <p className="pt-1 text-sm text-muted-foreground">{t("appearance.colorTheme.info")}</p>

                                <div className="mt-4 flex flex-wrap gap-4">
                                    {colorThemes.map((ct) => (
                                        <button type="button" key={ct.id} onClick={() => setColorTheme(ct.id)} className="group flex flex-col items-center gap-2" title={ct.label}>
                                            <div
                                                className={cn(
                                                    `swatch-${ct.id}`,
                                                    "size-9 rounded-full ring-offset-2 ring-offset-background transition-all",
                                                    colorTheme === ct.id ? "scale-110 ring-2 ring-foreground" : "hover:scale-105 hover:ring-2 hover:ring-foreground/40"
                                                )}
                                            />
                                            <span className={cn("text-xs transition-colors", colorTheme === ct.id ? "font-medium text-foreground" : "text-muted-foreground")}>{ct.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Header icons toggle */}
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label htmlFor="show-header-icons">{t("appearance.headerIcons.label", "Header Icons")}</Label>
                                    <p className="pt-1 text-sm text-muted-foreground">{t("appearance.headerIcons.info", "Show search, connection status, and settings icons in the header")}</p>
                                </div>
                                <Switch id="show-header-icons" checked={showHeaderIcons} onCheckedChange={setShowHeaderIcons} />
                            </div>

                            {/* Header logo toggle */}
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label htmlFor="show-header-logo">{t("appearance.headerLogo.label", "Header Logo")}</Label>
                                    <p className="pt-1 text-sm text-muted-foreground">{t("appearance.headerLogo.info", "Show the app logo in the header")}</p>
                                </div>
                                <Switch id="show-header-logo" checked={showHeaderLogo} onCheckedChange={setShowHeaderLogo} />
                            </div>

                            {/* Carousel dots toggle */}
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label htmlFor="show-carousel-dots">{t("appearance.carouselDots.label", "Carousel Dots")}</Label>
                                    <p className="pt-1 text-sm text-muted-foreground">{t("appearance.carouselDots.info", "Show navigation dots on the hero carousel")}</p>
                                </div>
                                <Switch id="show-carousel-dots" checked={showCarouselDots} onCheckedChange={setShowCarouselDots} />
                            </div>

                            {/* Footer toggle */}
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label htmlFor="show-footer">{t("appearance.footer.label", "Page Footer")}</Label>
                                    <p className="pt-1 text-sm text-muted-foreground">{t("appearance.footer.info", "Show the footer at the bottom of every page")}</p>
                                </div>
                                <Switch id="show-footer" checked={showFooter} onCheckedChange={setShowFooter} />
                            </div>

                            {/* Subtitles */}
                            <div className="space-y-4 border-t border-border pt-6">
                                <div>
                                    <Label>{t("appearance.subtitles.label", "Subtitles")}</Label>
                                    <p className="pt-1 text-sm text-muted-foreground">{t("appearance.subtitles.info", "Style and position of subtitles in the player")}</p>
                                </div>

                                {/* Live preview */}
                                <div className="relative flex h-24 items-end justify-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1f2937,#4b5563)]">
                                    <div
                                        className="absolute left-1/2 max-w-[90%] -translate-x-1/2 rounded px-2 py-0.5 text-center font-medium whitespace-pre-wrap"
                                        style={{
                                            bottom: `${subtitlePosition}%`,
                                            fontSize: { sm: "0.75rem", md: "0.9rem", lg: "1.05rem", xl: "1.25rem" }[subtitleFontSize],
                                            color: subtitleColor,
                                            backgroundColor: subtitleBackground === "none" ? "transparent" : subtitleBackground === "solid" ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.35)",
                                            textShadow: "0 1px 2px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.95)",
                                        }}
                                    >
                                        The quick brown fox
                                    </div>
                                </div>

                                {/* Text size */}
                                <div className="flex items-center justify-between gap-4">
                                    <Label>{t("appearance.subtitles.size", "Text size")}</Label>
                                    <div className="flex shrink-0 gap-1 rounded-lg border p-1">
                                        {(["sm", "md", "lg", "xl"] as const).map((sz) => (
                                            <button
                                                key={sz}
                                                type="button"
                                                onClick={() => setSubtitleFontSize(sz)}
                                                className={cn("rounded-md px-3 py-1.5 text-sm transition-all", subtitleFontSize === sz ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                {sz.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Text color */}
                                <div className="flex items-center justify-between gap-4">
                                    <Label>{t("appearance.subtitles.color", "Text color")}</Label>
                                    <div className="flex gap-2">
                                        {[
                                            { value: "#ffffff", label: "White" },
                                            { value: "#ffeb3b", label: "Yellow" },
                                            { value: "#4dd0e1", label: "Cyan" },
                                            { value: "#a5d6a7", label: "Green" },
                                        ].map((c) => (
                                            <button
                                                key={c.value}
                                                type="button"
                                                title={c.label}
                                                onClick={() => setSubtitleColor(c.value)}
                                                style={{ backgroundColor: c.value }}
                                                className={cn("size-7 rounded-full ring-offset-2 ring-offset-background transition-all", subtitleColor === c.value ? "scale-110 ring-2 ring-foreground" : "hover:scale-105 hover:ring-2 hover:ring-foreground/40")}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Background */}
                                <div className="flex items-center justify-between gap-4">
                                    <Label>{t("appearance.subtitles.background", "Background")}</Label>
                                    <div className="flex shrink-0 gap-1 rounded-lg border p-1">
                                        {([
                                            { value: "none", label: "None" },
                                            { value: "subtle", label: "Subtle" },
                                            { value: "solid", label: "Solid" },
                                        ] as const).map((bg) => (
                                            <button
                                                key={bg.value}
                                                type="button"
                                                onClick={() => setSubtitleBackground(bg.value)}
                                                className={cn("rounded-md px-3 py-1.5 text-sm transition-all", subtitleBackground === bg.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                {bg.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Position */}
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <Label>{t("appearance.subtitles.position", "Position")}</Label>
                                        <p className="pt-1 text-sm text-muted-foreground">{t("appearance.subtitles.positionInfo", "Height above the bottom of the video")}</p>
                                    </div>
                                    <div className="flex w-48 shrink-0 items-center gap-3">
                                        <Slider value={[subtitlePosition]} onValueChange={([v]) => setSubtitlePosition(v)} min={0} max={40} step={1} aria-label="Subtitle position" />
                                        <span className="w-10 text-right text-sm text-muted-foreground tabular-nums">{subtitlePosition}%</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- HISTORY ---------------- */}
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("history.title")}</CardTitle>
                            <CardDescription>{t("history.description")}</CardDescription>

                            <CardAction>
                                <ConfirmDialog
                                    title={t("history.clear.title")}
                                    description={t("history.clear.description")}
                                    onConfirm={clear}
                                    trigger={
                                        <Button variant="destructive" className={"max-w-min"} disabled={!history.length}>
                                            <Trash2 />
                                            <span className={"ml-1 hidden sm:inline"}>{t("history.clear.button")}</span>
                                        </Button>
                                    }
                                />
                            </CardAction>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {!history.length ? (
                                <Empty className="rounded-lg border py-10">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <Trash2 className="size-5" />
                                        </EmptyMedia>
                                        <EmptyTitle>{t("history.empty.title")}</EmptyTitle>
                                        <EmptyDescription>{t("history.empty.description")}</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : (
                                <div className="space-y-2">
                                    {history.map((item) => {
                                        const title = item.kind === "movie" ? item.item.title : `${item.item.tvshowtitle} • S${item.item.season_number}E${item.item.episode_number}`

                                        return (
                                            <Item key={title} className="lenis-stopped flex items-center justify-between border-dashed border-border">
                                                <ItemContent>
                                                    <P>{title}</P>
                                                </ItemContent>

                                                <ConfirmDialog
                                                    title={t("history.item.removeTitle")}
                                                    description={t("history.item.removeDescription")}
                                                    onConfirm={() => remove(item)}
                                                    trigger={
                                                        <Button variant="secondary" size="sm">
                                                            <Trash2 />
                                                            {t("history.item.removeButton")}
                                                        </Button>
                                                    }
                                                />
                                            </Item>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- SCROBBLER ---------------- */}
                <TabsContent value="scrobbler">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("scrobbler.title", "Scrobbler")}</CardTitle>
                            <CardDescription>{t("scrobbler.description", "Resume points and watched titles, tracked by your OMSS backend's scrobbler")}</CardDescription>

                            <CardAction>
                                <ConfirmDialog
                                    title={t("scrobbler.clear.title", "Clear scrobbler data")}
                                    description={t("scrobbler.clear.description", "This removes all resume points and watched status. This cannot be undone.")}
                                    onConfirm={scrobbleClear}
                                    trigger={
                                        <Button variant="destructive" className={"max-w-min"} disabled={!scrobbleItems.length}>
                                            <Trash2 />
                                            <span className={"ml-1 hidden sm:inline"}>{t("scrobbler.clear.button", "Clear")}</span>
                                        </Button>
                                    }
                                />
                            </CardAction>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {!valid ? (
                                <Empty className="rounded-lg border py-10">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <AlertTriangle className="size-5" />
                                        </EmptyMedia>
                                        <EmptyTitle>{t("scrobbler.unreachable.title", "OMSS backend unreachable")}</EmptyTitle>
                                        <EmptyDescription>{t("scrobbler.unreachable.description", "Set up your OMSS server to track resume points.")}</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : scrobbleLoading ? (
                                <P className="text-muted-foreground py-10 text-center text-sm">{t("common:loading", "Loading…")}</P>
                            ) : !scrobbleItems.length ? (
                                <Empty className="rounded-lg border py-10">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <Trash2 className="size-5" />
                                        </EmptyMedia>
                                        <EmptyTitle>{t("scrobbler.empty.title", "Nothing tracked yet")}</EmptyTitle>
                                        <EmptyDescription>{t("scrobbler.empty.description", "Play something and your progress will appear here.")}</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : (
                                <div className="space-y-2">
                                    {scrobbleItems.map((item) => (
                                        <Item key={item.key} className="lenis-stopped flex items-center justify-between border-dashed border-border">
                                            <ItemContent>
                                                <P
                                                    className="cursor-pointer transition-colors hover:text-primary"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => openMedia({ type: item.mediaType === "movie" ? "movie" : "tv", id: item.tmdbId })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") openMedia({ type: item.mediaType === "movie" ? "movie" : "tv", id: item.tmdbId })
                                                    }}
                                                >
                                                    {item.title}
                                                </P>
                                            </ItemContent>

                                            <div className="flex items-center gap-2">
                                                {item.progress > 2 && item.progress < 95 ? (
                                                    <Badge variant="outline">{Math.round(item.progress)}%</Badge>
                                                ) : (
                                                    <Badge variant="secondary">{t("scrobbler.item.watched", "Watched")}</Badge>
                                                )}

                                                <ConfirmDialog
                                                    title={t("scrobbler.item.removeTitle", "Remove entry")}
                                                    description={t("scrobbler.item.removeDescription", "Remove this title's resume point and watched status.")}
                                                    onConfirm={() => scrobbleRemove(item.key)}
                                                    trigger={
                                                        <Button variant="secondary" size="sm">
                                                            <Trash2 />
                                                            {t("scrobbler.item.removeButton", "Remove")}
                                                        </Button>
                                                    }
                                                />
                                            </div>
                                        </Item>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- FOLLOWING ---------------- */}
                <TabsContent value="following">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("following.title", "Following")}</CardTitle>
                            <CardDescription>{t("following.description", "Titles you follow for new-release notifications. Swipe down on a trailer to follow.")}</CardDescription>

                            <CardAction>
                                <ConfirmDialog
                                    title={t("following.clear.title", "Unfollow everything")}
                                    description={t("following.clear.description", "This removes all your follows. This cannot be undone.")}
                                    onConfirm={followClear}
                                    trigger={
                                        <Button variant="destructive" className={"max-w-min"} disabled={!follows.length}>
                                            <Trash2 />
                                            <span className={"ml-1 hidden sm:inline"}>{t("following.clear.button", "Clear")}</span>
                                        </Button>
                                    }
                                />
                            </CardAction>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {!valid ? (
                                <Empty className="rounded-lg border py-10">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <AlertTriangle className="size-5" />
                                        </EmptyMedia>
                                        <EmptyTitle>{t("following.unreachable.title", "OMSS backend unreachable")}</EmptyTitle>
                                        <EmptyDescription>{t("following.unreachable.description", "Set up your OMSS server to follow titles.")}</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : followsLoading ? (
                                <P className="text-muted-foreground py-10 text-center text-sm">{t("common:loading", "Loading…")}</P>
                            ) : !follows.length ? (
                                <Empty className="rounded-lg border py-10">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <Trash2 className="size-5" />
                                        </EmptyMedia>
                                        <EmptyTitle>{t("following.empty.title", "Not following anything yet")}</EmptyTitle>
                                        <EmptyDescription>{t("following.empty.description", "Open a title's trailer and swipe down to follow it.")}</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : (
                                <div className="space-y-2">
                                    {follows.map((f) => {
                                        const type = f.mediaType === "show" ? "tv" : "movie"
                                        const label = f.title ?? `${f.mediaType === "show" ? "Show" : "Movie"} ${f.tmdbId}`
                                        return (
                                            <Item key={f.mediaKey} className="lenis-stopped flex items-center justify-between border-dashed border-border">
                                                <ItemContent>
                                                    <P
                                                        className="cursor-pointer transition-colors hover:text-primary"
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => openMedia({ type, id: f.tmdbId })}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" || e.key === " ") openMedia({ type, id: f.tmdbId })
                                                        }}
                                                    >
                                                        {label}
                                                    </P>
                                                </ItemContent>

                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">{f.mediaType === "show" ? t("common:tvShow.singular", "Show") : t("common:movie.singular", "Movie")}</Badge>

                                                    <ConfirmDialog
                                                        title={t("following.item.removeTitle", "Unfollow")}
                                                        description={t("following.item.removeDescription", "Stop receiving release notifications for this title.")}
                                                        onConfirm={() => followUnfollow(f.mediaKey)}
                                                        trigger={
                                                            <Button variant="secondary" size="sm">
                                                                <Trash2 />
                                                                {t("following.item.removeButton", "Unfollow")}
                                                            </Button>
                                                        }
                                                    />
                                                </div>
                                            </Item>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- PLAYBACK ---------------- */}
                <TabsContent value="playback">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("playback.title")}</CardTitle>
                            <CardDescription>{t("playback.description")}</CardDescription>
                        </CardHeader>

                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label>{t("playback.autoplayNext.label")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("playback.autoplayNext.description")}</p>
                                </div>

                                <Switch checked={autoplayNext} onCheckedChange={setAutoplayNext} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- OMSS ---------------- */}
                <TabsContent value="omss">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("omss.title", { coreName: t("common:coreName") })}</CardTitle>
                            <CardDescription>{t("omss.description")}</CardDescription>
                            <CardAction>{valid ? <Badge>{t("omss.connection.connected")}</Badge> : <Badge variant="destructive">{t("omss.connection.disconnected")}</Badge>}</CardAction>
                        </CardHeader>

                        <CardContent>
                            <div className="space-y-2">
                                <Label htmlFor="omss">{t("omss.label", { coreName: t("common:coreName") })}</Label>

                                <span className="flex pt-1 text-muted-foreground">{t("omss.info")}</span>

                                <Input id="omss" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:3000" />

                                {!standalone && (
                                    <Item className="border-dashed border-border">
                                        <ItemHeader>
                                            <H4 className="flex items-center gap-2">
                                                <AlertTriangle />
                                                {t("omss.note.title")}
                                            </H4>
                                        </ItemHeader>
                                        <ItemContent>
                                            <P>{t("omss.note.value")}</P>
                                        </ItemContent>
                                    </Item>
                                )}

                                <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="library-only">Only show my library</Label>
                                        <span className="flex text-sm text-muted-foreground">
                                            Movies and TV Shows pages list only the titles available on your OMSS server, instead of browsing all of TMDB.
                                        </span>
                                    </div>
                                    <Switch id="library-only" checked={libraryOnly} onCheckedChange={setLibraryOnly} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- TMDB ---------------- */}
                <TabsContent value="tmdb">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("tmdb.title")}</CardTitle>
                            <CardDescription>{t("tmdb.description")}</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="tmdb">{t("tmdb.apiKey")}</Label>
                                <span className="flex pt-1 text-muted-foreground">{t("tmdb.info")}</span>
                                <Input disabled id="tmdb" value={maskKey(tmdbApiKey, 10)} />
                            </div>

                            <div className="mt-3 flex flex-col justify-between md:flex-row">
                                <div>
                                    <Label>{t("tmdb.region.cardlabel")}</Label>

                                    <span className="flex py-2 pr-0 text-muted-foreground md:pr-4">
                                        {t("tmdb.region.info", {
                                            projectName: t("common:projectName"),
                                        })}
                                    </span>
                                </div>

                                <Select
                                    value={region}
                                    onValueChange={(value) => {
                                        setRegion(value as CountryISO3166_1)
                                        cache?.clear()
                                        // Persist synchronously so the deferred write isn't lost to the reload (see language above).
                                        try {
                                            localStorage.setItem(profileScopedKey("app.region"), JSON.stringify(value))
                                        } catch {
                                            /* ignore storage failures */
                                        }
                                        location.reload()
                                    }}
                                >
                                    <SelectTrigger className="w-full md:w-3/5">
                                        <SelectValue placeholder={t("tmdb.region.placeholder")} />
                                    </SelectTrigger>

                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>{t("tmdb.region.selectlabel")}</SelectLabel>
                                        </SelectGroup>

                                        {supportedRegions.map((r) => (
                                            <SelectItem key={r.value} value={r.value}>
                                                {r.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-6 border-t pt-6">
                                <div>
                                    <Label>{t("tmdb.preferOriginal.label", "Prefer original-language content")}</Label>
                                    <span className="mt-1 flex text-muted-foreground">
                                        {t(
                                            "tmdb.preferOriginal.info",
                                            "On a title's detail, show its original-language title, overview, trailer and that region's streaming by default instead of your language. Falls back to your language when a title has no distinct original. You can still toggle per title."
                                        )}
                                    </span>
                                </div>
                                <Switch checked={preferOriginalContent} onCheckedChange={setPreferOriginalContent} />
                            </div>

                            <div className="mt-3 border-t pt-6">
                                <Label>{t("tmdb.searchLanguages.label", "Preferred search languages")}</Label>
                                <span className="mt-1 mb-3 flex text-muted-foreground">
                                    {t(
                                        "tmdb.searchLanguages.info",
                                        "Search these languages (beyond your own, which is always included first). Drag to set the priority order — earlier languages win a title's displayed name."
                                    )}
                                </span>
                                <PreferredLanguages />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </section>
    )
}
