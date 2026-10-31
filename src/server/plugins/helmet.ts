import type { FastifyInstance } from "fastify"
import helmet from "@fastify/helmet"

export async function registerHelmetPlugin(app: FastifyInstance) {
    await app.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                connectSrc: ["'self'", "https://api.themoviedb.org", "https://image.tmdb.org", app.config.VITE_STANDALONE ? "*" : (app.config.VITE_OMSS_API_URL ?? "")],

                imgSrc: ["'self'", "data:", "https://image.tmdb.org"],

                // YouTube IFrame Player API loader + the www-widgetapi.js it injects (trailer player).
                scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://s.ytimg.com"],
                scriptSrcElem: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://s.ytimg.com"],

                styleSrc: ["'self'", "'unsafe-inline'"],

                mediaSrc: ["'self'", "https:", "http:", "blob:"],
                fontSrc: ["'self'", "https:", "data:"],

                objectSrc: ["'none'"],

                baseUri: ["'self'"],
                formAction: ["'self'"],

                frameAncestors: ["'self'"],

                frameSrc: ["'self'", "https://www.youtube-nocookie.com", "https://www.youtube.com"],

                childSrc: ["'self'", "https://www.youtube-nocookie.com", "https://www.youtube.com"],
            },
        },

        referrerPolicy: {
            policy: "strict-origin-when-cross-origin",
        },

        crossOriginOpenerPolicy: { policy: "same-origin" },
        crossOriginResourcePolicy: { policy: "same-origin" },
    })
}
