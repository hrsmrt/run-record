// Supabase が1回に返す最大件数（これより多いときは続きを取得する）
const PAGE_SIZE = 1000

// .range(from, to) を付けたクエリを PAGE_SIZE ずつ取り、全件をつなげて返す
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
    const rows: T[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await build(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(error.message)
        rows.push(...(data ?? []) as T[])
        if ((data ?? []).length < PAGE_SIZE) break
    }
    return rows
}
