/**
 * Decode an image File into something drawable to a canvas. Prefers `createImageBitmap` (robust,
 * handles orientation, decodes off the main thread) and falls back to an `<img>` with onload/onerror —
 * which is more reliable across browsers than `HTMLImageElement.decode()` (Safari/HEIC can reject that
 * spuriously). Returns the drawable plus its intrinsic size and a cleanup fn.
 */
async function decodeImage(file: File): Promise<{ draw: CanvasImageSource; w: number; h: number; cleanup: () => void }> {
    if (typeof createImageBitmap === "function") {
        try {
            const bmp = await createImageBitmap(file)
            return { draw: bmp, w: bmp.width, h: bmp.height, cleanup: () => bmp.close() }
        } catch {
            // fall through to the <img> path
        }
    }

    const url = URL.createObjectURL(file)
    const img = new Image()
    try {
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error("image decode failed"))
            img.src = url
        })
    } catch (e) {
        URL.revokeObjectURL(url)
        throw e
    }
    return { draw: img, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, cleanup: () => URL.revokeObjectURL(url) }
}

/**
 * Read an image File, center-crop it to a square, downscale to `size` px, and return a compact JPEG
 * data URL. Used for profile avatars so an uploaded photo is stored small (a few KB of base64) in the
 * profile's `avatar` string rather than a full-resolution image.
 */
export async function fileToSquareDataUrl(file: File, size = 256, quality = 0.82): Promise<string> {
    const { draw, w, h, cleanup } = await decodeImage(file)
    try {
        if (!w || !h) throw new Error("image has no dimensions")

        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("no 2d context")

        // Cover: scale so the shorter side fills the square, then center the overflow.
        const scale = Math.max(size / w, size / h)
        const dw = w * scale
        const dh = h * scale
        ctx.drawImage(draw, (size - dw) / 2, (size - dh) / 2, dw, dh)

        return canvas.toDataURL("image/jpeg", quality)
    } finally {
        cleanup()
    }
}
