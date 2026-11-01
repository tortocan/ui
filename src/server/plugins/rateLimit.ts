/**
 * Rate limiting plugin configuration
 */
import type { FastifyInstance } from "fastify"
import rateLimit from "@fastify/rate-limit"

export async function registerRateLimitPlugin(app: FastifyInstance) {
    await app.register(rateLimit, {
        max: 100,
        timeWindow: "1 second",
        // Only rate-limit the API surface. Static assets and the SPA document are served by the same
        // app; a single cold page load pulls dozens of chunks/fonts, and behind a reverse proxy every
        // visitor collapses onto one req.ip bucket — so a global limiter 429s legitimate asset bursts
        // (self-DoS). The /api/* routes are the only ones worth protecting here.
        allowList: (req) => !req.url.startsWith("/api"),
    })
}
