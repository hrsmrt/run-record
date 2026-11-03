import { useEffect } from "react"

// 未保存の変更がある間、タブを閉じる・再読み込み・外部サイトへの移動時に確認を出す
export function useUnsavedWarning(hasUnsaved: boolean) {
    useEffect(() => {
        if (!hasUnsaved) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ""
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [hasUnsaved])
}
