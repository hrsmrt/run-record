// http/https の URL だけをリンク先として許可する（javascript: などは null）
export const safeHttpUrl = (url: string | null | undefined): string | null =>
    url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null
