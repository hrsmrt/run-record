"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUnsavedWarning } from "@/lib/use-unsaved-warning"
import { enrollmentToStr, parseEnrollmentYear, yearsSinceEnrollment } from "@/lib/enrollment"
import { createAccount, resetPassword, type NewAccount } from "@/app/event/edit-members/actions"
import { matchesMember } from "@/lib/members"

type Member = {
    user_id: string
    name: string | null
    display_name: string | null
    gender: string | null
    enrollment_year: number | null
    name_kana: string | null
    // 非表示（検証用など）。メンバーを選ぶ一覧・記録の一覧に出ない
    is_hidden: boolean
    // アカウントなし（profiles_pending）
    is_pending: boolean
    // アカウントはあるがプロフィールがない人は false
    has_profile: boolean
    email: string | null
    last_sign_in_at: string | null
}

// 作成・再発行した初期パスワード（画面にだけ表示し、閉じたら消える）
type IssuedPassword = { email: string; password: string; note: string }

const emptyAccount = (): NewAccount => ({ email: "", pendingId: null, displayName: "", name: "", nameKana: "", gender: "", enrollmentYear: "" })

const label = (m: Member) => m.display_name || m.name || (m.has_profile ? "名前未設定" : "（プロフィール未登録）")

// 管理者がメンバーのアカウント作成・紐付け・パスワード再発行と、入学年度の入力を行う。
// 一覧の取得・入学年度・紐付けは所有者権限の関数（中で2段階認証済みの管理者かを確かめる）、
// アカウントの作成・再発行はサーバー側の処理（app/event/edit-members/actions.ts）で行う
export function EditMembersClient() {
    const [members, setMembers] = useState<Member[] | null>(null)
    // 変更中の入学年度（user_id → 入力欄の文字列）
    const [edits, setEdits] = useState<Map<string, string>>(new Map())
    // 変更中のふりがな（user_id → 入力欄の文字列）
    const [kanaEdits, setKanaEdits] = useState<Map<string, string>>(new Map())
    const [query, setQuery] = useState("")
    const [onlyMissing, setOnlyMissing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
    const [account, setAccount] = useState<NewAccount>(emptyAccount)
    const [issued, setIssued] = useState<IssuedPassword | null>(null)
    const [copied, setCopied] = useState(false)
    // 紐付け先を選んでいる「アカウントなし」の人と、選んだ紐付け先のアカウント
    const [linking, setLinking] = useState<{ pendingId: string; userId: string } | null>(null)

    useUnsavedWarning(edits.size > 0 || kanaEdits.size > 0)
    const changedCount = new Set([...edits.keys(), ...kanaEdits.keys()]).size

    const load = useCallback(async () => {
        const { data, error } = await createClient().rpc("admin_list_members")
        if (error) { setMessage({ text: `メンバー一覧の読み込みに失敗しました: ${error.message}`, isError: true }); return }
        setMembers((data ?? []) as Member[])
    }, [])

    useEffect(() => { load() }, [load])

    const pendings = useMemo(() => (members ?? []).filter(m => m.is_pending).sort((a, b) => label(a).localeCompare(label(b))), [members])
    const accounts = useMemo(() => (members ?? []).filter(m => !m.is_pending).sort((a, b) => label(a).localeCompare(label(b))), [members])

    // 入学年度の新しい順（未登録は先頭）、同じ年度の中はふりがな順。名前・ふりがな・メールで検索
    const shown = useMemo(() => (members ?? [])
        .filter(m => !onlyMissing || m.enrollment_year == null || !m.name_kana)
        .filter(m => query === "" || matchesMember({ ...m, name: label(m) }, query) || (m.name ?? "").includes(query) || (m.email ?? "").includes(query))
        .sort((a, b) => (b.enrollment_year ?? 9999) - (a.enrollment_year ?? 9999)
            || (a.name_kana || label(a)).localeCompare(b.name_kana || label(b), "ja")),
    [members, onlyMissing, query])

    const showIssued = (p: IssuedPassword) => { setIssued(p); setCopied(false) }

    const setEdit = (m: Member, value: string) => setEdits(prev => {
        const next = new Map(prev)
        if (value === enrollmentToStr(m.enrollment_year)) next.delete(m.user_id)
        else next.set(m.user_id, value)
        return next
    })

    const setKanaEdit = (m: Member, value: string) => setKanaEdits(prev => {
        const next = new Map(prev)
        if (value === (m.name_kana ?? "")) next.delete(m.user_id)
        else next.set(m.user_id, value)
        return next
    })

    const handleSave = async () => {
        if (!members) return
        const changes = members.flatMap(m => edits.has(m.user_id) ? [{ m, year: parseEnrollmentYear(edits.get(m.user_id)!) }] : [])
        const invalid = changes.filter(c => c.year === undefined).map(c => label(c.m))
        if (invalid.length > 0) {
            setMessage({ text: `入学年度は西暦4桁（例: 2017）で入力してください: ${invalid.join("、")}`, isError: true })
            return
        }
        setSaving(true)
        const supabase = createClient()
        const failed: string[] = []
        const saved = new Map<string, number | null>()
        for (const { m, year } of changes) {
            const { error } = await supabase.rpc("admin_set_enrollment_year", { p_user_id: m.user_id, p_year: year })
            if (error) failed.push(`${label(m)}（${error.message}）`)
            else saved.set(m.user_id, year ?? null)
        }
        const savedKana = new Map<string, string>()
        for (const m of members.filter(x => kanaEdits.has(x.user_id))) {
            const kana = kanaEdits.get(m.user_id)!.trim()
            const { error } = await supabase.rpc("admin_set_name_kana", { p_user_id: m.user_id, p_name_kana: kana })
            if (error) failed.push(`${label(m)}（${error.message}）`)
            else savedKana.set(m.user_id, kana)
        }
        setSaving(false)
        setMembers(prev => (prev ?? []).map(m => ({
            ...m,
            ...(saved.has(m.user_id) ? { enrollment_year: saved.get(m.user_id)! } : {}),
            ...(savedKana.has(m.user_id) ? { name_kana: savedKana.get(m.user_id) || null } : {}),
        })))
        const drop = (ids: Map<string, unknown>) => (prev: Map<string, string>) => {
            const next = new Map(prev)
            ids.forEach((_, id) => next.delete(id))
            return next
        }
        setEdits(drop(saved))
        setKanaEdits(drop(savedKana))
        setMessage(failed.length > 0
            ? { text: `保存に失敗しました: ${failed.join(" / ")}`, isError: true }
            : { text: `${new Set([...saved.keys(), ...savedKana.keys()]).size}人の変更を保存しました`, isError: false })
    }

    const pendingOf = (id: string | null) => pendings.find(p => p.user_id === id)

    const handleCreate = async () => {
        const pending = pendingOf(account.pendingId)
        const who = pending ? label(pending) : account.displayName.trim()
        if (!confirm(`${account.email.trim()} で「${who}」のアカウントを作成しますか？`)) return
        setBusy(true)
        setMessage(null)
        const result = await createAccount(account)
        setBusy(false)
        if (!result.ok) { setMessage({ text: result.error, isError: true }); return }
        setAccount(emptyAccount())
        showIssued({
            email: result.email,
            password: result.password,
            note: pending ? `「${who}」のアカウントを作成し、記録${result.moved}件を引き継ぎました。` : `「${who}」のアカウントを作成しました。`,
        })
        load()
    }

    const handleLink = async () => {
        if (!linking?.userId) return
        const pending = pendingOf(linking.pendingId)
        const target = accounts.find(a => a.user_id === linking.userId)
        if (!pending || !target) return
        if (!confirm(`「${label(pending)}」の記録を ${target.email ?? label(target)} のアカウントに移し、「アカウントなし」の「${label(pending)}」を削除します。よろしいですか？`)) return
        setBusy(true)
        const { data, error } = await createClient().rpc("admin_link_account", { p_pending_id: pending.user_id, p_user_id: target.user_id })
        setBusy(false)
        if (error) { setMessage({ text: `紐付けに失敗しました: ${error.message}`, isError: true }); return }
        setLinking(null)
        setMessage({ text: `「${label(pending)}」を ${target.email ?? label(target)} に紐付けました（記録${data ?? 0}件）`, isError: false })
        load()
    }

    // 非表示はチェックしたらすぐ保存する
    const handleHidden = async (m: Member, hidden: boolean) => {
        if (hidden && !confirm(`${label(m)}を非表示にしますか？ メンバーを選ぶ一覧や記録の一覧に出なくなります（あとで戻せます）。`)) return
        setBusy(true)
        const { error } = await createClient().rpc("admin_set_member_hidden", { p_user_id: m.user_id, p_hidden: hidden })
        setBusy(false)
        if (error) { setMessage({ text: `保存に失敗しました: ${error.message}`, isError: true }); return }
        setMembers(prev => (prev ?? []).map(x => x.user_id === m.user_id ? { ...x, is_hidden: hidden } : x))
        setMessage({ text: `${label(m)}を${hidden ? "非表示にしました" : "表示に戻しました"}`, isError: false })
    }

    const handleReset = async (m: Member) => {
        if (!confirm(`${m.email} のパスワードを再発行しますか？ 今のパスワードは使えなくなります。`)) return
        setBusy(true)
        setMessage(null)
        const result = await resetPassword(m.user_id)
        setBusy(false)
        if (!result.ok) { setMessage({ text: result.error, isError: true }); return }
        showIssued({ email: result.email, password: result.password, note: `「${label(m)}」のパスワードを再発行しました。` })
    }

    const copyIssued = async () => {
        if (!issued) return
        try {
            await navigator.clipboard.writeText(`メールアドレス: ${issued.email}\n初期パスワード: ${issued.password}`)
            setCopied(true)
        } catch {
            setMessage({ text: "コピーできませんでした。表示されている内容を手で写してください", isError: true })
        }
    }

    if (!members) return <p className="px-4 text-sm">{message?.text ?? "読み込み中..."}</p>

    const selectedPending = pendingOf(account.pendingId)
    const inputClass = "border rounded px-2 py-1 bg-white"

    return (
        <div className="px-4 pb-8 max-w-4xl text-sm">
            <section className="mb-6 p-3 border rounded bg-white">
                <h2 className="font-bold mb-2">アカウント作成</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="email"
                        value={account.email}
                        onChange={e => setAccount({ ...account, email: e.target.value })}
                        placeholder="メールアドレス"
                        className={`${inputClass} w-64`}
                    />
                    <select
                        value={account.pendingId ?? ""}
                        onChange={e => setAccount({ ...account, pendingId: e.target.value || null })}
                        className={inputClass}
                        aria-label="引き継ぐ人"
                    >
                        <option value="">新しい人</option>
                        {pendings.map(p => <option key={p.user_id} value={p.user_id}>{label(p)}（アカウントなし）を引き継ぐ</option>)}
                    </select>
                    {!selectedPending && (
                        <>
                            <input
                                value={account.displayName}
                                onChange={e => setAccount({ ...account, displayName: e.target.value })}
                                placeholder="表示名"
                                className={`${inputClass} w-32`}
                            />
                            <input
                                value={account.name}
                                onChange={e => setAccount({ ...account, name: e.target.value })}
                                placeholder="名前（空欄なら表示名）"
                                className={`${inputClass} w-44`}
                            />
                            <input
                                value={account.nameKana}
                                onChange={e => setAccount({ ...account, nameKana: e.target.value })}
                                placeholder="ふりがな"
                                className={`${inputClass} w-32`}
                            />
                            <select value={account.gender} onChange={e => setAccount({ ...account, gender: e.target.value })} className={inputClass} aria-label="性別">
                                <option value="">性別</option>
                                <option value="male">男性</option>
                                <option value="female">女性</option>
                            </select>
                            <input
                                value={account.enrollmentYear}
                                onChange={e => setAccount({ ...account, enrollmentYear: e.target.value })}
                                placeholder="入学年度"
                                inputMode="numeric"
                                className={`${inputClass} w-24`}
                            />
                        </>
                    )}
                    <button
                        onClick={handleCreate}
                        disabled={busy}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {busy ? "処理中..." : "作成"}
                    </button>
                </div>
                {selectedPending && (
                    <p className="mt-2 text-xs text-gray-600">
                        「{label(selectedPending)}」の名前・性別・入学年度と記録を、新しいアカウントに引き継ぎます。
                    </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                    初期パスワードは自動で作り、作成後に1回だけ表示します。本人は初回ログイン時にパスワードの変更が必要です。
                </p>
            </section>

            {issued && (
                <section className="mb-6 p-3 border-2 border-yellow-400 rounded bg-yellow-50" role="status">
                    <p className="mb-2">{issued.note} 次の内容を本人に伝えてください。<strong>この画面を閉じると再表示できません。</strong></p>
                    <p className="font-mono">メールアドレス: {issued.email}</p>
                    <p className="font-mono">初期パスワード: <span className="select-all">{issued.password}</span></p>
                    <div className="mt-2 flex gap-3">
                        <button onClick={copyIssued} className="px-3 py-1 border rounded bg-white hover:bg-gray-100">
                            {copied ? "コピーしました" : "コピー"}
                        </button>
                        <button onClick={() => setIssued(null)} className="text-blue-600 hover:underline">閉じる</button>
                    </div>
                </section>
            )}

            {message && (
                <p className={`mb-3 ${message.isError ? "text-red-600" : "text-green-700"}`}>{message.text}</p>
            )}

            <h2 className="font-bold mb-2">メンバー一覧</h2>
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="名前・メールで検索"
                    className={`${inputClass} w-44`}
                />
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
                    入学年度・ふりがなが未登録の人のみ
                </label>
                <span className="text-gray-500">
                    {shown.length}人（未登録 {members.filter(m => m.enrollment_year == null).length}人）
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="border-collapse bg-white whitespace-nowrap">
                    <thead>
                        <tr className="border-b text-left">
                            <th className="px-2 py-1">名前</th>
                            <th className="px-2 py-1">ふりがな</th>
                            <th className="px-2 py-1">アカウント</th>
                            <th className="px-2 py-1">入学年度</th>
                            <th className="px-2 py-1">今年度</th>
                            <th className="px-2 py-1">非表示</th>
                            <th className="px-2 py-1">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {shown.map(m => {
                            const value = edits.get(m.user_id) ?? enrollmentToStr(m.enrollment_year)
                            const year = parseEnrollmentYear(value)
                            const isLinking = linking?.pendingId === m.user_id
                            return (
                                <tr key={m.user_id} className={edits.has(m.user_id) || kanaEdits.has(m.user_id) ? "bg-yellow-50" : m.is_hidden ? "bg-gray-100 text-gray-500" : ""}>
                                    <td className={`px-2 py-1 ${m.gender === "female" ? "text-red-600" : ""}`}>
                                        {label(m)}
                                        {m.name && m.display_name && m.name !== m.display_name && (
                                            <span className="ml-1 text-xs text-gray-500">（{m.name}）</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1">
                                        {m.has_profile ? (
                                            <input
                                                value={kanaEdits.get(m.user_id) ?? m.name_kana ?? ""}
                                                onChange={e => setKanaEdit(m, e.target.value)}
                                                placeholder="ふりがな"
                                                aria-label={`${label(m)}のふりがな`}
                                                className="w-32 border rounded px-1 py-0.5"
                                            />
                                        ) : null}
                                    </td>
                                    <td className="px-2 py-1 text-xs text-gray-600">
                                        {m.is_pending ? "なし" : m.email}
                                        {!m.is_pending && !m.last_sign_in_at && <span className="ml-1 text-orange-600">未ログイン</span>}
                                    </td>
                                    <td className="px-2 py-1">
                                        {m.has_profile ? (
                                            <input
                                                value={value}
                                                onChange={e => setEdit(m, e.target.value.trim())}
                                                inputMode="numeric"
                                                placeholder="例: 2017"
                                                aria-label={`${label(m)}の入学年度`}
                                                className={`w-20 border rounded px-1 py-0.5 ${year === undefined ? "border-red-500" : ""}`}
                                            />
                                        ) : <span className="text-xs text-gray-500">プロフィール登録後</span>}
                                    </td>
                                    <td className="px-2 py-1 text-gray-600">{year != null ? `${yearsSinceEnrollment(year)}年目` : ""}</td>
                                    <td className="px-2 py-1 text-center">
                                        {m.has_profile && (
                                            <input
                                                type="checkbox"
                                                checked={m.is_hidden}
                                                disabled={busy}
                                                onChange={e => handleHidden(m, e.target.checked)}
                                                aria-label={`${label(m)}を非表示にする`}
                                            />
                                        )}
                                    </td>
                                    <td className="px-2 py-1 text-xs">
                                        {m.is_pending ? (
                                            isLinking ? (
                                                <span className="flex items-center gap-2">
                                                    <select
                                                        value={linking.userId}
                                                        onChange={e => setLinking({ pendingId: m.user_id, userId: e.target.value })}
                                                        className="border rounded px-1 py-0.5 bg-white"
                                                        aria-label="紐付け先のアカウント"
                                                    >
                                                        <option value="">紐付け先のアカウント</option>
                                                        {accounts.map(a => <option key={a.user_id} value={a.user_id}>{label(a)}（{a.email}）</option>)}
                                                    </select>
                                                    <button onClick={handleLink} disabled={busy || !linking.userId} className="text-blue-600 hover:underline disabled:opacity-50">紐付け</button>
                                                    <button onClick={() => setLinking(null)} className="text-gray-600 hover:underline">やめる</button>
                                                </span>
                                            ) : (
                                                <span className="flex gap-3">
                                                    <button
                                                        onClick={() => { setAccount({ ...emptyAccount(), pendingId: m.user_id }); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                                                        className="text-blue-600 hover:underline"
                                                    >
                                                        アカウント作成
                                                    </button>
                                                    <button onClick={() => setLinking({ pendingId: m.user_id, userId: "" })} className="text-blue-600 hover:underline">
                                                        既存のアカウントに紐付け
                                                    </button>
                                                </span>
                                            )
                                        ) : (
                                            <button onClick={() => handleReset(m)} disabled={busy} className="text-blue-600 hover:underline disabled:opacity-50">
                                                パスワード再発行
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-3 flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving || changedCount === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? "保存中..." : `入学年度・ふりがなの変更を保存${changedCount > 0 ? `（${changedCount}人）` : ""}`}
                </button>
            </div>
            <p className="mt-6 text-xs text-gray-500">
                ※ 入学年度は全メンバー（閲覧用アカウントを含む）に表示されます。生年は表示されません。
                アカウントのあるメンバーは、本人もプロフィールで入力できます。
                「既存のアカウントに紐付け」は、ダッシュボードで作ったアカウントや、本人がプロフィールを作って2人に分かれた場合に使います。
                管理人・閲覧用アカウントのパスワードはここでは再発行できません。
                「非表示」にした人（検証用など）は、メンバーを選ぶ一覧・記録の一覧・練習録の参加メンバーに出なくなります。練習録や掲示板の書き込みは残るので、必要なら削除してください。
            </p>
        </div>
    )
}
