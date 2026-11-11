"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { EnrollmentTag } from "@/components/EnrollmentTag"
import {
    PLAN_LABELS, PLAN_NOTE_MAX, PLAN_STATUSES, PLAN_STYLES, type PlanStatus, type RacePlan, canRecruit,
} from "@/lib/race-plans"

type Fields = { status: PlanStatus; race_id: number | null; is_private: boolean; recruiting: boolean; note: string | null }

type Props = {
    editionId: number
    races: { id: number; name: string }[]
    plans: RacePlan[]
    // 閲覧用アカウントは登録できない
    canEdit: boolean
    compact?: boolean
    onChanged: () => void
}

// 開催回ごとのメンバーの予定（エントリー済み・参加予定・検討中・気になる）と、自分の予定のボタン。
// compact（ホーム）では人数と募集している人だけを出し、種目・自分だけに表示・募集・ひとことの欄は出さない
export function RacePlanPanel(props: Props) {
    // 保存したひとことが読み込み直されたら、入力欄をその値で作り直す
    const mineNote = props.plans.find(p => p.is_me)?.note ?? ""
    return <RacePlanPanelInner key={mineNote} {...props} />
}

function RacePlanPanelInner({ editionId, races, plans, canEdit, compact = false, onChanged }: Props) {
    const mine = plans.find(p => p.is_me)
    const [note, setNote] = useState(mine?.note ?? "")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    // 自分の予定を保存する（null なら取り消す）。変えない項目は今の値を使う
    const save = async (change: Partial<Fields> | null) => {
        setBusy(true)
        setError("")
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setBusy(false); setError("ログインしてください"); return }
        let result
        if (change == null) {
            result = await supabase.from("race_plans").delete().eq("event_edition_id", editionId).eq("user_id", user.id)
        } else {
            const next: Fields = {
                status: mine?.status ?? "going",
                race_id: mine?.race_id ?? null,
                is_private: mine?.is_private ?? false,
                recruiting: mine?.recruiting ?? false,
                note: mine?.note ?? null,
                ...change,
            }
            // 気になる・自分だけに表示にしたら、募集は外す
            if (!canRecruit(next.status, next.is_private)) next.recruiting = false
            result = await supabase.from("race_plans").upsert(
                { event_edition_id: editionId, user_id: user.id, ...next, updated_at: new Date().toISOString() },
                { onConflict: "event_edition_id,user_id" },
            )
        }
        setBusy(false)
        if (result.error) { setError(`保存に失敗しました: ${result.error.message}`); return }
        onChanged()
    }

    // 同じボタンをもう一度押したら取り消す
    const pressStatus = (s: PlanStatus) => {
        if (mine?.status === s) {
            if (mine.recruiting && !confirm("予定を取り消すと、募集も消えます。取り消しますか？")) return
            save(null)
        } else {
            save({ status: s })
        }
    }

    const recruiters = plans.filter(p => p.recruiting)
    if (plans.length === 0 && !canEdit) return null

    return (
        <div className="flex flex-col gap-1.5 text-xs">
            {recruiters.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                    {recruiters.map((p, i) => (
                        <li key={i} className="bg-orange-50 border border-orange-200 rounded px-2 py-1">
                            <span className="font-bold text-orange-700 mr-1">募集</span>
                            <span className={p.gender === "female" ? "text-red-600" : ""}>{p.name ?? "（退会したメンバー）"}<EnrollmentTag year={p.enrollment_year} /></span>
                            <span className="text-gray-600">（{PLAN_LABELS[p.status]}{p.race_name && `・${p.race_name}`}）</span>
                            {p.note && <span className="ml-1">「{p.note}」</span>}
                        </li>
                    ))}
                </ul>
            )}

            {compact ? (
                plans.length > 0 && (
                    <p className="text-gray-700">
                        {PLAN_STATUSES.map(s => ({ s, n: plans.filter(p => p.status === s).length })).filter(x => x.n > 0)
                            .map(x => `${PLAN_LABELS[x.s]} ${x.n}人`).join("・")}
                    </p>
                )
            ) : (
                PLAN_STATUSES.map(s => {
                    const list = plans.filter(p => p.status === s)
                    if (list.length === 0) return null
                    return (
                        <p key={s} className="flex flex-wrap items-baseline gap-x-2">
                            <span className={`px-1 rounded border ${PLAN_STYLES[s]}`}>{PLAN_LABELS[s]} {list.length}人</span>
                            {list.map((p, i) => (
                                <span key={i} className={p.gender === "female" ? "text-red-600" : ""}>
                                    {p.is_me ? "あなた" : p.name ?? "（退会したメンバー）"}{!p.is_me && <EnrollmentTag year={p.enrollment_year} />}
                                    {p.race_name && <span className="text-gray-500">（{p.race_name}）</span>}
                                    {p.is_me && p.is_private && <span className="text-gray-500">（自分だけに表示）</span>}
                                </span>
                            ))}
                        </p>
                    )
                })
            )}

            {canEdit && (
                <div className="flex flex-wrap items-center gap-1">
                    <span className="text-gray-600 mr-1">あなたの予定:</span>
                    {PLAN_STATUSES.map(s => (
                        <button
                            key={s}
                            onClick={() => pressStatus(s)}
                            disabled={busy}
                            aria-pressed={mine?.status === s}
                            className={`px-2 py-0.5 rounded border disabled:opacity-50 ${mine?.status === s ? PLAN_STYLES[s] : "bg-white hover:bg-gray-100"}`}
                        >
                            {PLAN_LABELS[s]}
                        </button>
                    ))}
                </div>
            )}

            {canEdit && mine && !compact && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-1">
                    {races.length > 0 && (
                        <label className="flex items-center gap-1">
                            種目
                            <select
                                value={mine.race_id ?? ""}
                                disabled={busy}
                                onChange={e => save({ race_id: e.target.value === "" ? null : Number(e.target.value) })}
                                className="border rounded px-1 py-0.5 bg-white"
                            >
                                <option value="">未定</option>
                                {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </label>
                    )}
                    <label className="flex items-center gap-1">
                        <input type="checkbox" checked={mine.is_private} disabled={busy} onChange={e => save({ is_private: e.target.checked })} />
                        自分だけに表示
                    </label>
                    <label className={`flex items-center gap-1 ${canRecruit(mine.status, mine.is_private) ? "" : "text-gray-400"}`}>
                        <input
                            type="checkbox"
                            checked={mine.recruiting}
                            disabled={busy || !canRecruit(mine.status, mine.is_private)}
                            onChange={e => save({ recruiting: e.target.checked, note: note.trim() || null })}
                        />
                        一緒に出る人を募集
                    </label>
                    <span className="flex items-center gap-1 flex-1 min-w-[200px]">
                        <input
                            value={note}
                            maxLength={PLAN_NOTE_MAX}
                            onChange={e => setNote(e.target.value)}
                            placeholder="ひとこと（例: 前泊します。宿を一緒に取りませんか）"
                            className="border rounded px-1 py-0.5 bg-white flex-1"
                            aria-label="ひとこと"
                        />
                        {note.trim() !== (mine.note ?? "") && (
                            <button onClick={() => save({ note: note.trim() || null })} disabled={busy} className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                                保存
                            </button>
                        )}
                    </span>
                    {!canRecruit(mine.status, mine.is_private) && (
                        <span className="basis-full text-gray-500">募集は「気になる」以外で、自分だけに表示にしていないときに付けられます。</span>
                    )}
                </div>
            )}
            {error && <p className="text-red-600">{error}</p>}
        </div>
    )
}
