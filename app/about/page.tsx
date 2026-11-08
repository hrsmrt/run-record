import type { Metadata } from "next"
import Link from "next/link"
import { ObfuscatedEmail } from "@/components/ObfuscatedEmail"

export const metadata: Metadata = { title: "このサイトについて | Runner’s Record" }

// このサイトについて（ログインしていなくても読める。記録が載っているアカウントのない人も読めるように）。
// メンバーの名前や記録などの個人の情報は載せない
export default function AboutPage() {
    const section = "flex flex-col gap-1"
    const h2 = "text-base font-bold"
    return (
        <main className="max-w-3xl mx-auto p-4 flex flex-col gap-5 text-sm leading-relaxed">
            <h1 className="text-2xl font-bold">このサイトについて</h1>

            <section className={section}>
                <p>
                    Runner&apos;s Record は、ホノルルマラソンを走る会（ホノマラ）の OBOG が、マラソンなどの大会の記録や練習を共有するための、メンバー限定のサイトです。
                    管理人の村田（2017年入学）が個人で運営する<strong>非公式</strong>のサイトで、ホノルルマラソンを走る会の公式サイトではありません。営利目的ではありません。
                </p>
            </section>

            <section className={section}>
                <h2 className={h2}>載せている情報</h2>
                <ul className="list-disc pl-5">
                    <li>メンバーの名前（表示名）・ふりがな・性別・入学年度</li>
                    <li>大会の記録（タイム、ラップ、順位、クレバー指数など）</li>
                    <li>練習の予定と記録（日時、集合場所、参加者、ルート）、参加の回答</li>
                    <li>メンバーが書いた大会レポート、練習の感想、掲示板の書き込み</li>
                    <li>メンバーが登録した大会のコースや練習のルート（GPS の位置と標高のみ。時刻・心拍などは保存しません。自宅などが分からないよう、スタート・ゴール付近を消して保存できます）</li>
                </ul>
                <p>生年とメールアドレスは管理のためだけに使い、ほかのメンバーには表示しません。</p>
            </section>

            <section className={section}>
                <h2 className={h2}>記録の出どころ</h2>
                <p>
                    記録は、本人、大会ごとの幹事、または管理人（村田）が、大会の公式結果をもとに入力しています。
                    アカウントを持っていない OBOG の記録も、同じように公式結果をもとに載せていることがあります。
                </p>
            </section>

            <section className={section}>
                <h2 className={h2}>見られる人</h2>
                <ul className="list-disc pl-5">
                    <li>ログインしたメンバー（アカウントを持つ OBOG）と、メンバーに共有している閲覧用アカウントで入った人だけが見られます</li>
                    <li>ログインしていない人は、このページとログイン画面以外は見られません</li>
                    <li>検索エンジンには登録しない設定にしています</li>
                </ul>
            </section>

            <section className={section}>
                <h2 className={h2}>使い道</h2>
                <p>
                    メンバー同士で記録や練習を共有し、交流や練習・大会選びの参考にするために使います。
                    メンバー以外に提供したり、ほかの目的に使ったりはしません。
                </p>
            </section>

            <section className={section}>
                <h2 className={h2}>掲載をやめたい・直したいとき</h2>
                <ul className="list-disc pl-5">
                    <li>
                        <strong>アカウントがある人</strong>：自分の記録やプロフィールは、自分で直したり消したりできます。
                        プロフィールの「他の人（大会の幹事）に自分の記録を登録させない」をオンにすると、幹事が代わりに登録できなくなります。
                    </li>
                    <li>
                        <strong>アカウントがない人・自分で直せないとき</strong>：管理人（村田、メール: <ObfuscatedEmail />）までご連絡ください。
                        記録の削除や、一覧に表示しない設定で対応します。
                    </li>
                </ul>
            </section>

            <section className={section}>
                <h2 className={h2}>大会情報について</h2>
                <p>
                    大会情報は確認済みのものを載せていますが、誤りがある可能性もあるため、公式情報もご確認ください。
                    地図は国土地理院の<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer" className="underline">地理院タイル</a>と標高データを使っています。
                </p>
            </section>

            <p className="text-xs text-gray-500">2026年11月8日 作成</p>
            <Link href="/" className="text-blue-600 hover:underline">← ホームへ</Link>
        </main>
    )
}
