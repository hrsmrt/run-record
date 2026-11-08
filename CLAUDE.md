# Runner's Record 開発メモ

## プロジェクト概要
ホノマラOBOG向け記録共有サイト（非公式）
- Next.js + TypeScript + Tailwind CSS
- Supabase（認証・データベース）
- ホノマラ（ホノルルマラソンを走る会）OBOG のメンバー限定（全ページログイン必須）。掲載は管理者が知り得た範囲

## ページ構成
全ページログイン必須（`/auth/*` と `robots.txt` を除く）。「メンバーのみ」は閲覧用アカウントでは入れないページ。
- `/` - ホームページ（各ページへのリンクカード表示）
- `/latest` - 最近の記録（大会ごと。今年度の大会と直近20大会の多い方）
- `/races` - 出場大会記録（大会ごとに新しい順。年度・大会名・メンバー名・種目・入学年度で絞り込み、条件は URL に保持）
- `/practices` - 練習録（新しい順。年度・参加メンバー名で絞り込み）
- `/practices/[id]` - 練習録の詳細（主催者・距離・累積標高・主催者コメント・ルートの地図と高低差・GPX ダウンロード・参加メンバー・コメント。コメントは参加メンバーのみ）
- `/practices/new`・`/practices/[id]/edit` - 練習録の作成・編集（メンバーのみ。編集は作った人と管理者）
- `/search` - 検索ページ
- `/links` - リンク集
- `/profile` - プロフィール（メンバーのみ）
- `/records` - 自分の記録（メンバーのみ）
- `/records/form` - フォームで記録追加（メンバーのみ）
- `/records/upload` - CSV形式で記録追加（メンバーのみ）
- `/records/edit` - 記録を編集（メンバーのみ）
- `/records/[id]/splits` - ラップ入力（メンバーのみ、自分の記録のみ。管理者は全員分）
- `/reports/edit/[editionId]` - 大会レポート（感想・観光）の編集（メンバーのみ）
- `/event` - 大会一覧（都道府県コード順）
- `/event/editions` - 開催一覧
- `/event/schedule` - カレンダー（年度・週単位、祝日表示）
- `/event/[id]` - 大会詳細（基本情報・開催回・種目・参加者の記録とラップ）
- `/event/edit-events` - 大会編集（admin のみ）
- `/event/edit-editions` - 開催日編集（admin のみ）
- `/event/edit-races` - 種目編集（admin のみ。エントリー数・部門ごとのエントリー数もここ）
- `/event/edit-results` - 記録一括登録（admin のみ。1レースに複数人、アカウントのない人の追加も可）
- `/event/edit-members` - メンバー編集（admin のみ。アカウント作成・紐付け・パスワード再発行、入学年度の入力）
- `/auth/mfa` - 2段階認証（TOTP）の登録・入力

## 設計メモ

### 認証・アクセス制御
- **メンバー限定**: middleware（`lib/supabase/middleware.ts`）で全ページをログイン必須にし、DB 側でも `anon` の読み取りを禁止している（`sql/2026-11-03_members_only.sql`）。画面だけでなく API からも未ログインでは読めない
- **閲覧用共有アカウント**: `viewer@runners-record.local`（`lib/viewer.ts`）、`app_metadata.role = "viewer"`。ログイン画面の「閲覧用パスワード」欄からパスワードのみでログインする。記録・プロフィール・大会編集・パスワード変更には入れず（middleware）、`results`・`result_splits`・`profiles` への書き込みは RESTRICTIVE ポリシーで禁止
- **ユーザー登録**: ブラウザからの新規登録は廃止（Supabase の「Allow new users to sign up」はオフ）。管理者がアプリの `/event/edit-members` で作成する
  1. メールアドレスと表示名・性別・入学年度を入れて「作成」。「アカウントなし」で記録がある人は「〇〇を引き継ぐ」を選ぶと、名前などと記録をそのまま移す
  2. 初期パスワードは自動で作り、作成直後に1回だけ表示される（保存しない）。本人にアプリの外（メール・LINE など）で伝える
  3. 本人は初回ログインでパスワード変更を求められ（`app_metadata.must_change_password`、middleware で転送）、プロフィールがなければプロフィール入力に案内される（`lib/after-sign-in.ts`）
  - パスワードを忘れた人は、同じページの「パスワード再発行」で新しい初期パスワードを出す（管理者・閲覧用アカウントは対象外）
  - ダッシュボード（Authentication → Users → Add user、Auto Confirm User にチェック）で作ったアカウントにも、ログイン後のプロフィール案内は効く。アカウントなしの人の記録は「既存のアカウントに紐付け」で移す
  - 作成・再発行はサーバー側（`app/event/edit-members/actions.ts`）で service_role キー（環境変数 `APP_SUPABASE_SECRET_KEY`、`NEXT_PUBLIC_` を付けない）を使う。クライアントは `lib/supabase/admin.ts`（`server-only`）。処理の最初に admin・aal2 を確認する
  - 紐付けは `admin_link_account()`（記録の付け替え・プロフィール作成・アカウントなしの行の削除を1トランザクションで）
- **admin 判定**: `app_metadata.role === "admin"`。編集ページはサーバー側で判定してリダイレクトするが、実際の書き込み制限は RLS（`sql/admin_policies.sql`）
- **管理者の2段階認証**: 管理者の権限（大会情報の編集、他メンバーの記録・ラップ）は TOTP 認証済み（`aal2`）のときだけ。画面は `lib/admin.ts` の `getAdminState`（`adminActive`）と middleware、DB は各ポリシーの `auth.jwt() ->> 'aal' = 'aal2'`（`sql/2026-11-03_admin_require_mfa.sql`）
- **検索エンジン対策**: `app/robots.ts`（全拒否）、`app/layout.tsx` の noindex メタタグ、`next.config.ts` の `X-Robots-Tag` ヘッダー

### データ構成
- **大会情報**: `events`（大会）→ `event_editions`（開催回）→ `races`（種目、`distance_km` は `NUMERIC(8,4)`）
- **結果**: `results`
  - `race_id` で `races` に紐付け（NULL 可。大会情報に未登録の大会は紐付けなしで `race_name`・`date` を使う）。`ON DELETE RESTRICT` のため、結果が紐付いた種目・開催回は削除できない
  - `clever_index` は RUNNET のクレバー指数の転記（`NUMERIC`、精度指定なし）
  - `race_type` は結果側の値（road / trail / track / time）。`events.type` とは別物
- **ラップ**: `result_splits`（`result_id`, `distance_km`, `elapsed_ms`、`(result_id, distance_km)` で一意）
  - 通過タイムは号砲からのグロス。0km の行がスタートロス。ネット = 通過 − ロス
  - 計算・書式は `lib/splits.ts`、表示は `components/SplitTable.tsx`
  - `rank` は通過順位（任意）
- **順位・エントリー数**（`sql/2026-11-05_ranks.sql`）
  - `results.overall_rank`・`gender_rank`・`division`（部門名、大会の表記のまま）・`division_rank`。順位は大会の公式順位を転記（市民マラソンはネット順が多い）
  - 母数は大会情報側: `races.entrants_total`・`entrants_male`・`entrants_female`、部門ごとは `race_divisions`（`race_id`, `name`, `entrants`）
  - `public_results` の `overall_total`・`gender_total`（本人の性別で男女を選ぶ）・`division_total`（`race_id` と部門名の完全一致で結合）が母数
  - 書式は `lib/ranks.ts`（`parseCount`・`formatRank`）
- **入学年度**（`sql/2026-11-06_enrollment_year.sql`）
  - `profiles.enrollment_year`・`profiles_pending.enrollment_year`（SMALLINT）。`public_results.enrollment_year` は2つの表を直接結合して取る（`profiles_all` の定義は手元にないため変更していない）
  - 記録の表では名前の横に下二桁（例:（17））。プロフィール・絞り込み・メンバー編集では「〜年目」（今年度 − 入学年度 + 1、年度は4月始まり）。`lib/enrollment.ts`・`components/EnrollmentTag.tsx`
  - 管理者の一覧取得・変更は所有者権限の関数 `admin_list_members()`・`admin_set_enrollment_year()`（関数内で admin・aal2 を確認）
- **練習録**（`sql/2026-11-08_practices.sql`）
  - `practices`（日付・タイトル・主催者・距離・主催者コメント（列名は `memo`）、GPX 用の `elevation_gain_m`・`route_path`・`route_line` は第2段階用）、`practice_participants`、`practice_comments`（練習×本人で1件）
  - 参加者・主催者は `results` と同じく profiles_all の ID（アカウントなしの人も可）。`admin_link_account()` で記録と一緒に付け替える
  - 保存は `save_practice()`（呼んだ人の権限で動き、参加メンバーの付け外しも1回で）。編集できるかは `practice_can_edit()`
  - 参加メンバーの選択は `member_directory()`、その場での「アカウントなし」の追加は `add_pending_member()`（どちらもメンバーのみ、閲覧用は不可）
  - 表示は `public_practices`・`public_practice_participants`・`public_practice_comments`（ID を出さない。閲覧用アカウントも読める）。名前の取得元は `member_names`（誰も直接読めない）
- **練習録のルート**（`sql/2026-11-08_practice_routes.sql`）
  - GPX は Storage の非公開バケット `practice-routes` に `練習録ID/route.gpx`。読むのはメンバー、置く・消すのは練習録を編集できる人（`practice_route_can_edit()` がパスの練習録IDで判定）。ダウンロードは署名付き URL
  - 取り込みはすべてブラウザ側（`lib/gpx.ts`）: 距離はハバーサインの合計、累積標高は道のり±25mで平均し3m以上の上りだけ数える。スタート・ゴールから指定 m 以内を消し（既定300m）、位置と標高だけの GPX にして保存（時刻・心拍は入れない）。距離・累積標高は消す前の全体で数える
  - 地図用の線 `route_line` は最大約600点に間引いた `[緯度, 経度, 標高, km]` の配列。一覧では取らない（`PRACTICE_LIST_COLUMNS`）
  - 地図は Leaflet + 地理院タイル（淡色・標準・写真、出典表示が必要）、`components/RouteMap.tsx`。高低差は `components/ElevationChart.tsx`。Tailwind の `img { max-width: 100% }` がタイルを崩すので `globals.css` で地図内だけ外している
- **大会レポート**: `race_reports`（開催回ごと、感想・観光の文章のみ、改行とリンク）、表示は `public_race_reports`
- **公開ビュー**: `public_results` に一本化（旧 `public_record`・`public_full_best` など14個は削除済み）
  - `category`（5km / 10km / half / full / 100km / under100 / over100 / time）、`is_best`（利用者×区分のベスト。時間走は距離が長い方）、`has_splits`（ラップ有無）
  - 紐付いた記録は大会名・日付を大会情報から取る（`COALESCE`）。`event_id` で大会詳細へリンク
  - `user_id` は公開しない。所有者権限で動くため Supabase の SECURITY DEFINER 警告は想定どおり
  - `profiles_all`（未登録OBOGの `profiles_pending` を含む）は生年を含むため `anon`・`authenticated` から直接読めないようにしている
  - **ビューを作り直したら** `REVOKE ALL ON public_results FROM anon;` を再実行すること

### その他
- **環境変数**: Supabase のキーは `NEXT_PUBLIC_SUPABASE_ANON_KEY` に統一。アカウント作成用に `APP_SUPABASE_SECRET_KEY`（このアプリ専用の secret キー。サーバー側のみ。Vercel と `.env.local` に設定。Supabase 連携が入れる `SUPABASE_SERVICE_ROLE_KEY`・`SUPABASE_SECRET_KEY` とは別）
- **DB定義**: `sql/` は `.gitignore` 対象（ローカルのみ）。定義を変えたら Supabase の SQL Editor で手動反映する。各ファイルに `_rollback.sql` を用意
- **日時**: `races.entry_start_at` などは TIMESTAMPTZ。表示・入力はブラウザのタイムゾーンで変換する（ISO文字列を切り出すと9時間ずれる）

## 最近の作業履歴

### 2026-11-08: 管理者によるアカウント作成、練習録

#### DB
- `2026-11-08_accounts.sql` - `admin_list_members()` を作り直し（プロフィールのないアカウント・メール・最終ログインを追加）、`admin_link_account()` を追加
- `2026-11-08_practices.sql` - 練習録（表・公開ビュー・関数）、`admin_link_account()` に練習録の付け替えを追加
- `2026-11-08_practice_routes.sql` - GPX のファイル置き場と権限、`public_practices` に `route_line`・`route_path` を追加

#### アプリ
- メンバー編集ページでアカウント作成（アカウントなしの人の引き継ぎ可）・既存アカウントへの紐付け・パスワード再発行
- 初回ログイン時のパスワード変更の強制、プロフィールがない人をプロフィール入力へ案内
- 検索ページの「ベスト記録のみ」を全種目でも選べるように
- 練習録（日付・タイトル・主催者・参加メンバー・距離・主催者コメント・コメント）
- 練習録のルート（GPX の取り込み、地理院地図、距離・累積標高の自動計算、スタート・ゴール付近の削除、高低差のグラフ）

### 2026-11-06: 出場大会記録、入学年度、OBOG 向けの文言

#### DB
- `2026-11-06_enrollment_year.sql` - 入学年度、`public_results.enrollment_year`、管理者用の関数（`2026-11-05_ranks.sql` の後に実行）

#### アプリ
- 出場大会記録ページ `/races`（`components/RaceHistory.tsx`、最近の記録と共通の `components/RaceGroups.tsx`）
- 入学年度の入力（プロフィール、一括登録の人の追加、メンバー編集）と、記録の表の名前の横に入学年度の下二桁（例:（17））、出場大会記録・検索で入学年度の絞り込み
- ホーム・ログイン・フッター・メタデータの説明を「ホノマラOBOG向け記録共有サイト（非公式）」に

### 2026-11-04〜05: グラフの拡張、順位・エントリー数

#### DB
- `2026-11-05_ranks.sql` - 順位・部門・通過順位、エントリー数（`races`・`race_divisions`）、`public_results` に列追加

#### アプリ
- 大会詳細のグラフ（`components/RaceGapChart.tsx`）を「基準ペースとの差／順位の変動／ラップ（区間ペース）」の切り替えに。凡例で表示する人を選べる（順位は表示中の人の中で数える）
- 大会詳細の参加者の記録は、初期表示をクレバー指数の高い順（なければタイム順）に。順位・部門の列を追加（入力がある開催回のみ）
- 記録追加・編集・一括登録・ラップ入力に順位・部門・通過順位、種目編集にエントリー数と部門の編集欄（`components/RaceDivisionsEditor.tsx`）
- 大会詳細ページの PC 表示幅を `max-w-6xl` に

#### それ以前（2026-11-03〜04、詳細は git log）
- 大会レポート、差のグラフ、管理者による記録の登録・編集と一括登録、管理者の2段階認証、ログイン後の画面遷移の修正、LAN 内からの開発サーバー接続（`next.config.ts` の `allowedDevOrigins`）

#### 今後の候補
- 検索ページ・最近の記録にも順位を表示
- 通過順位を使った「大会全体での順位の推移」グラフ
- Postgres の更新（Supabase ダッシュボード、利用の少ない時間帯に）

### 2026-11-03（後半）: 結果と大会情報の紐付け、ラップ、メンバー限定化

#### DB（`sql/` の実行順）
1. `2026-11-03_link_results.sql` - `results.race_id`・`clever_index` 追加、`result_splits` 作成、`public_results` 作成
2. `2026-11-03_drop_old_public_views.sql` - 旧公開ビュー14個を削除（アプリ切り替え後）
3. `2026-11-03_link_existing_results.sql` - 既存結果を大会名の対応表で紐付け（228件中120件）。開催回・種目がなければ作成し、作成分は `migration_created_rows` に記録。大会を追加登録したら `name_map` に行を足して再実行できる
4. `2026-11-03_splits_allow_start.sql` - `result_splits` に 0km（スタート）を許可
5. `2026-11-03_public_results_has_splits.sql` - `public_results.has_splits` 追加
6. `2026-11-03_members_only.sql` - メンバー限定化（閲覧用アカウントを先に作成してから実行）

#### アプリ
- 記録一覧（`components/RecordTable.tsx`）を `public_results` の `category`・`is_best` で絞り込む形に変更。クレバー指数・ラップ列を追加
- 記録追加・編集で大会情報の紐付け（`components/RaceInput.tsx`、datalist で検索）とクレバー指数を入力可能に
- ラップ入力ページ `/records/[id]/splits`（スタート既定表示、1/5/10kmごと一括追加、フルはハーフ地点も追加、ネットと記録の不一致警告）
- 大会詳細ページに開催回ごとの参加者の記録とラップを表示（`components/EditionResults.tsx`）
- メンバー限定化（閲覧用パスワード、middleware、検索エンジン対策）
- `profiles_all` が未ログインで読めて生年が露出していたため権限を剥奪、未使用の `public_others` を削除

#### 今後の候補
- CSV 取り込み（`/records/upload`）で大会名から自動照合、クレバー指数・ラップに対応
- 大会詳細ページのラップ取得を、記録一覧と同じく「表示」時に1件ずつ取得する形に揃える
- 未紐付けの結果（108件）の大会を登録して紐付ける

### 2026-11-03（前半）: 大会情報の編集・詳細ページ追加、セキュリティ見直し

#### 大会情報
- 管理者用編集ページ3つを追加（`app/event/edit-*` + `components/Edit*Client.tsx`、共通ナビ `components/EventAdminNav.tsx`）
  - 変更行のみ保存（黄色表示）、未保存時の離脱警告（`lib/use-unsaved-warning.ts`、アプリ内リンク遷移では出ない）
  - 新規追加のメッセージはフォーム直下に表示
  - 開催回削除時は CASCADE で消える種目数を確認表示
  - 県は選択式
- 大会詳細ページ `/event/[id]` を追加し、一覧・開催一覧・カレンダーの大会名横に「詳細」リンクを設置
- 都道府県の並び順と比較関数を `lib/prefectures.ts` に共通化（都道府県コード順）
- ヘッダーに admin のみ表示される「大会情報を編集」を追加
- `races.distance_km` を `NUMERIC(5,2)` → `NUMERIC(8,4)` に変更（42.195 が 42.20 に丸められていたため）

#### セキュリティ・その他
- 新規登録機能を削除（招待パスワードが `NEXT_PUBLIC_` 環境変数でブラウザに露出し、照合もブラウザ側のみだったため）
- `/records`・`/records/edit` の取得に `.eq("user_id", user.id)` を追加
- `app/page.tsx`・`app/links/page.tsx` の不要な `"use client"` を削除
- Next 16 で `next lint` が廃止されたため、`npm run lint` を `eslint .` に変更
- Next.js を 16.4.4 に更新（`npm audit fix`）、Supabase パッケージのバージョンを固定
- `auth/confirm` のオープンリダイレクト、コメント欄リンクの URL スキームを修正
- Supabase テンプレートの未使用ページ・コンポーネント（`/protected`、`components/tutorial` など）を削除

#### 今後の候補
- `/event`・`/event/editions`・`/event/[id]` をサーバー側でのデータ取得に変更（現在は useEffect でブラウザから取得）
- `app/distance/` はサンプルデータのみの試作ページ（未コミット）
- `middleware.ts` は Next 16 で非推奨（`proxy.ts` への改名が必要）

### 2025-11-22: リンク集ページ追加とホームページ改修

#### 追加・変更したファイル
1. **app/links/page.tsx** (新規作成)
   - 関連サイトのリンク集ページ
   - 現在のリンク:
     - ホノルルマラソンを走る会 (http://www.honomara.net/)
     - 大会録 (https://ameblo.jp/honomara2025/)
   - リンク追加方法: `links`配列に`{id, title, url, description}`形式で追加

2. **components/header.tsx** (95-103行目)
   - ヘッダーメニューに「リンク集」を追加
   - 「検索」の後、ログイン必要なメニューの前に配置

3. **app/page.tsx** (全体を書き換え)
   - `/latest`へのリダイレクトから、各ページへのリンクカード表示に変更
   - 3つのカード: 最新の記録、検索、リンク集
   - アイコン付き、ホバーエフェクトあり
   - レスポンシブ対応（モバイル: 縦並び、PC: 3列）

#### UTF-8エンコーディング設定
4. **.vscode/settings.json** (新規作成)
   - すべてのファイルのデフォルトエンコーディングをUTF-8に設定
   - Markdown, TypeScript, JavaScript, JSONなど主要ファイルタイプで強制

#### eslint対応
5. **app/page.tsx, components/header.tsx**
   - `Runner's Record` → `Runner&apos;s Record` にエスケープ修正
   - eslintチェック: ✔ No ESLint warnings or errors

#### RecordTableのcomment欄リンク機能追加
6. **components/RecordTable.tsx** (104-146行目, 217-219行目)
   - Markdown形式のリンク `[テキスト](URL)` をパースする機能を追加
   - テキストとリンクが混在している場合にも対応
   - 例: `大会の様子は[こちら](https://example.com)を参照`
   - 複数リンクにも対応

#### 次回作業時のポイント
- リンク集にリンクを追加する場合は、`app/links/page.tsx`の`links`配列を編集
- ヘッダーメニューの順序: 最近の記録 → 検索 → リンク集 → [メンバー向けメニュー（閲覧用アカウントでは非表示）] → [admin のみ: 大会情報を編集]
- RecordTableのcomment欄でリンクを使う場合は、`[リンクテキスト](URL)`の形式で記述
- コード変更後は `npm run lint` でeslintチェックを実施
