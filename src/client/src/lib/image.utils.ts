/**
 * Read an image File, center-crop it to a square, downscale to `size` px, and return a compact JPEG
 * data URL. Used for profile avatars so an uploaded photo is stored small (a few KB of base64) in the
 * profile's `avatar` string rather than a full-resolution image.
 */
export async function fileToSquareDataUrl(file: File, size = 256, quality = 0.82): Promise<string> {
    const objectUrl = URL.createObjectURL(file)
    try {
        const img = new Image()
        img.src = objectUrl
        await img.decode()

        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("no 2d context")

        // Cover: scale so the shorter side fills the square, then center the overflow.
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)

        return canvas.toDataURL("image/jpeg", quality)
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}
