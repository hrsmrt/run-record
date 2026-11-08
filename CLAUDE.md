# Runner's Record 開発メモ

## プロジェクト概要
ホノマラOBOG向け記録共有サイト（非公式）
- Next.js + TypeScript + Tailwind CSS
- Supabase（認証・データベース）
- ホノマラ（ホノルルマラソンを走る会）OBOG のメンバー限定（全ページログイン必須）。掲載は管理者が知り得た範囲

## ページ構成
全ページログイン必須（`/auth/*` と `robots.txt` を除く）。「メンバーのみ」は閲覧用アカウントでは入れないページ。
- `/` - ホーム（一番上に新着のお知らせ1行、今後の練習予定、掲示板（新着を先に5件、最後の返信を1行）、大会の記録と練習録を日付の新しい順に混ぜた一覧。`components/HomeFeed.tsx`。各ページへはヘッダーのメニューから）
- `/latest` - 最近の記録（大会ごと。今年度の大会と直近20大会の多い方）
- `/races` - 出場大会記録（大会ごとに新しい順。年度・大会名・メンバー名・種目・入学年度で絞り込み、条件は URL に保持）
- `/practices` - 練習録（上に今後の予定、下にこれまでの練習。年度・参加メンバー名で絞り込み）
- `/practices/[id]` - 練習録の詳細（主催者・距離・累積標高・主催者コメント・ルートの地図と高低差・GPX ダウンロード・参加メンバー・コメント。コメントは参加メンバーのみ）
- `/practices/new`・`/practices/[id]/edit` - 練習録の作成・編集（メンバーのみ。編集は作った人と管理者）
- `/board` - 掲示板（話題を最後に動きがあった順）
- `/board/new` - 話題を立てる（メンバーのみ。候補日を入れると日程調整）
- `/board/[id]` - 話題（本文・日程調整の ○△× の表・返信）
- `/search` - 検索ページ
- `/links` - リンク集
- `/profile` - プロフィール（メンバーのみ）
- `/records` - 自分の記録（メンバーのみ）
- `/records/form` - フォームで記録追加（メンバーのみ）
- `/records/upload` - CSV形式で記録追加（メンバーのみ）
- `/records/edit` - 記録を編集（メンバーのみ）
- `/records/bulk` - 幹事による記録の一括登録の入口（大会 → 開催日 → 種目を選ぶ・追加して幹事になる）。`?edition=開催回ID` で一括登録（その開催回の幹事のときだけ）
- `/records/[id]/splits` - ラップ入力（メンバーのみ、自分の記録のみ。管理者は全員分）
- `/reports/edit/[editionId]` - 大会レポート（感想・観光）の編集（メンバーのみ）
- `/event` - 大会一覧（都道府県コード順）
- `/event/editions` - 開催一覧
- `/event/schedule` - カレンダー（年度・週単位、祝日表示）
- `/event/[id]` - 大会詳細（基本情報・開催回・種目・コースの地図・参加者の記録とラップ）
- `/event/edit-events` - 大会編集（admin のみ）
- `/event/edit-editions` - 開催日編集（admin のみ）
- `/event/edit-races` - 種目編集（admin のみ。エントリー数・部門ごとのエントリー数もここ）
- `/event/edit-results` - 記録一括登録（admin のみ。1レースに複数人、アカウントのない人の追加も可）
- `/event/edit-history` - 記録の変更履歴（admin のみ）
- `/event/edit-merge` - 重複した大会・開催回・種目をまとめる（admin のみ）
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
- **ふりがな・メンバーの並び順と検索**（`sql/2026-11-08_member_catalog.sql`）
  - `profiles.name_kana`・`profiles_pending.name_kana`、`member_names.name_kana`。本人はプロフィール、管理者はメンバー編集（`admin_set_name_kana()`）で入れる
  - 並び順は入学年度の新しい順 → ふりがな順（入学年度なしは最後。練習録の参加メンバーは主催者が先頭）、検索は名前・ふりがな・入学年度（「17」で2017年度入学）、ひらがな・カタカナを区別しない（`lib/members.ts`）
  - 記録の一括登録のメンバー選択は検索できる入力欄 `components/MemberCombobox.tsx`（管理者・幹事とも `entry_member_list()`）
- **メンバーによる大会・開催回・種目の追加**（同じ SQL）
  - `events`・`event_editions`・`races` に `created_by`。追加はメンバー全員、修正・削除は追加した本人と管理者（既存の行は管理者のみ）。`public_catalog_creators` で大会詳細に「追加: 〇〇」
  - 選ぶ・追加するのは `components/RacePicker.tsx`（大会 → 開催日 → 種目。似た名前の大会を「この大会ではありませんか？」と出す。`normalizeEventName` は空白・第〇回・年・「大会」を無視）。記録追加・一括登録・幹事の入口で使う
  - 同じ大会の同じ開催日・同じ開催回の同じ距離と名前の種目は一意の制約（既存の重複があれば付けずに NOTICE）
  - 管理者は `admin_merge_events()`・`admin_merge_editions()`・`admin_merge_races()` でまとめる（開催回・種目・記録・部門・コース・レポート・幹事を付け替え、同じ日・同じ種目はさらにまとめる。同じ人の記録・レポート、両方にあるコースは止める）。件数の確認は `admin_merge_preview()`
- **開催回ごとの幹事**（`sql/2026-11-08_edition_organizers.sql`）
  - `edition_organizers`（開催回 × メンバー）。メンバーなら誰でも大会詳細の「幹事になる」でなれる（やめるのは本人と管理者）
  - 幹事はその開催回の種目に、他のメンバー（アカウントなし含む）の記録を一括登録できる（`/records/bulk`、`BulkResultsClient` の `editionId` あり）。自分が登録した記録だけ削除できる。本人が入れた記録は変えられない。判定は `race_organizer_can()` と `results.created_by`
  - 本人の「他の人（幹事）に自分の記録を登録させない」（`block_others_entry`、`member_allows_entry()`）。管理者の登録は対象外
  - `results` は同じ人・同じ種目で1件まで（`results_race_user_unique`、エラーコード 23505）
  - `public_results.entered_by_name`: 本人以外が登録した記録は登録した人の名前（大会詳細に「登録: 〇〇」）
  - 変更履歴 `results_history`（トリガー `log_results_change()` で insert / update / delete を自動記録）、管理者は `admin_results_history` で名前つきで読む
- **練習予定・参加ボタン・やりとり・掲示板・日程調整**（`sql/2026-11-08_practice_plans.sql`）
  - 練習予定は「記録済みでなく、日付が今日以降」の `practices`（`isUpcoming`）。`start_time`・`meeting_place`・`rsvp_deadline` を追加し、`save_practice()` の引数も増やした
  - `is_recorded`（`sql/2026-11-08_practice_recorded.sql`）: 練習録として登録済みか。過去の日付は必ず true、未来は false、当日は作る人が選ぶ（「今日」は日本時間）。予定は `finish_practice()`（「参加」の人を参加メンバーに入れて記録済みにする）で終える。当日でも記録済みなら「これまでの練習」に出す
  - 参加ボタン `practice_rsvps`（yes / maybe / no とひとこと、練習×本人で1件）。練習の後、作った人・管理者が `apply_rsvps_to_participants()` で「参加」の人を参加メンバーに入れる
  - 練習ごとのやりとり `practice_messages`（全メンバーが何件でも。参加メンバーの感想 `practice_comments` とは別）
  - 掲示板 `board_threads`・`board_posts`、日程調整 `thread_date_options`（立てた人・管理者が付け外し）・`thread_date_votes`（ok / maybe / ng）。候補日から `/practices/new?date=&title=&thread=` で予定を作ると `decided_practice_id` に結び付く
  - 書き込みは本人名義、削除は本人と管理者（`is_admin_active()`）。閲覧用アカウントは読むだけ（RESTRICTIVE ポリシー、公開ビュー `public_practice_rsvps`・`public_practice_messages`・`public_board_threads`・`public_board_posts`・`public_thread_date_options`・`public_thread_date_votes`）。○△× の表の行は `voter_key`（user_id と話題 ID の md5）でそろえ、user_id は出さない
  - やりとりの一覧と書き込み欄は `components/MessageThread.tsx`（練習と掲示板で共通）
  - 新着の表示は `lib/seen.ts`（最後に見た日時を localStorage に。初めて使った日時より前の動きは新着にしない）、`public_practices.last_activity_at`・`public_board_threads.last_activity_at` と比べる
- **練習録のルート案**（`sql/2026-11-08_practice_plan_routes.sql`）
  - 作成・編集画面で地図をクリックして点を置き、直線でつないで描く（`components/RoutePlanner.tsx`）。点はドラッグで移動、1つ戻す・周回・往復・過去の練習録のルートから始める（`simplifyLine` で点を減らす）
  - 標高は国土地理院の標高タイル dem_png（z14、10m メッシュ、CORS 許可あり）を canvas で読む（`lib/elevation.ts`）。点の間を25mごとに細かくして標高を付け、`processRoute()` で距離・累積標高・GPX・地図用の線を作る（`lib/route-plan.ts`）
  - `practices.plan_route_*`・`plan_distance_km`・`plan_elevation_gain_m`、GPX は `practice-routes` の `練習録ID/plan.gpx`（権限は実際のルートと同じ）。実際に走ったルートとは別に持ち、詳細ページでは両方を出す（ルート案は紫、1kmごとの印）
- **大会のコース**（`sql/2026-11-08_race_routes.sql`）
  - 種目ごとに1つ、メンバーが計測した GPX を `race_routes`（`races` とは別の表）と非公開バケット `race-routes`（`種目ID/route.gpx`）に保存
  - 未登録の種目への登録はその種目に自分の記録がある人と管理者（`race_route_can_edit()`、画面のボタン用に `race_route_editable()`）。差し替え・削除は登録した本人と管理者のみ（`race_route_can_replace()`、`sql/2026-11-08_race_routes_owner_only.sql`。ファイルの上書きも同じ条件）
  - `uploaded_by` は RLS で本人に固定し、`public_race_routes` で登録した人の名前を出す（`can_edit` は差し替え・削除できるか）。差し替えると前の GPX は上書きされ残らない
  - 大会詳細の開催回ごとに `components/RaceRoutes.tsx`。地図は「地図を表示」で開いたときに `route_line` を取る。5kmごとの印（GPS の目安）
  - GPX の選択・消す範囲・プレビューは練習録と共通の `components/GpxPicker.tsx`（大会は既定で消さない）
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
- `2026-11-08_race_routes.sql` - 大会のコース（`race_routes`、ファイル置き場、`public_race_routes`）
- `2026-11-08_race_routes_owner_only.sql` - コースの差し替え・削除を登録した本人と管理者に限る
- `2026-11-08_practice_plans.sql` - 練習予定の項目、参加ボタン、練習ごとのやりとり、掲示板、日程調整
- `2026-11-08_practice_recorded.sql` - 練習が記録済みかどうか（`is_recorded`）、`finish_practice()`
- `2026-11-08_board_last_post.sql` - `public_board_threads` に最後の返信（先頭80文字・書いた人・日時）を追加
- `2026-11-08_practice_plan_routes.sql` - 練習録のルート案の列、`public_practices` に追加
- `2026-11-08_edition_organizers.sql` - 開催回ごとの幹事、記録の一意の制約、登録させない設定、変更履歴、`public_results.entered_by_name`
- `2026-11-08_member_catalog.sql` - ふりがな、メンバーによる大会・開催回・種目の追加、重複の防止、管理者による「まとめる」

#### アプリ
- メンバー編集ページでアカウント作成（アカウントなしの人の引き継ぎ可）・既存アカウントへの紐付け・パスワード再発行
- 初回ログイン時のパスワード変更の強制、プロフィールがない人をプロフィール入力へ案内
- 検索ページの「ベスト記録のみ」を全種目でも選べるように
- 練習録（日付・タイトル・主催者・参加メンバー・距離・主催者コメント・コメント）
- 練習録のルート（GPX の取り込み、地理院地図、距離・累積標高の自動計算、スタート・ゴール付近の削除、高低差のグラフ）
- ホームをリンクカードから「大会の記録と練習録の新しい順の一覧」に変更し、メニューに大会情報を追加
- 練習録の地図の全画面表示、大会のコース（種目ごとの GPX、登録した人の名前、5kmごとの印）
- 練習予定と参加ボタン、練習ごとのやりとり、掲示板と日程調整、新着の表示
- 練習録のルート案（地図で描く、地理院の標高）
- 開催回ごとの幹事（他のメンバーの記録の一括登録）、記録の変更履歴
- ふりがなと入学年度順・検索できるメンバー選択、メンバーによる大会の追加（大会 → 開催日 → 種目の選択）、重複をまとめる管理画面
- 今後の候補: ルート案を道路に沿わせる（OpenRouteService など。API キーはサーバー側で）、GPX の時刻からラップを自動で入れる（ラップ入力ページの補助。GPX は保存しない）、新着のメール通知（メール配信サービスが必要）、最後に見た日時を DB に持たせて端末間でそろえる

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
- ヘッダーメニューの順序: 最近の記録 → 出場大会記録 → 練習録 → 掲示板 → 大会情報 → 検索 → リンク集 → [メンバー向けメニュー（閲覧用アカウントでは非表示。記録をまとめて登録（幹事）を含む）] → [admin のみ: 大会情報を編集]
- RecordTableのcomment欄でリンクを使う場合は、`[リンクテキスト](URL)`の形式で記述
- コード変更後は `npm run lint` でeslintチェックを実施
