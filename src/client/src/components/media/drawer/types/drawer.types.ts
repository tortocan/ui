export interface MediaDrawerPayload {
    type: "movie" | "tv" | "collection"
    id: number
}

export interface MediaDrawerContextType {
    stack: MediaDrawerPayload[]
    open: (payload: MediaDrawerPayload) => void
    close: () => void
    closeAll: () => void
    isVisible: boolean
}
