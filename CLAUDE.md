# Runner's Record 開発メモ

## プロジェクト概要
マラソン等大会結果記録・共有ツール
- Next.js + TypeScript + Tailwind CSS
- Supabase（認証・データベース）
- サークルOBOGなどメンバー限定（全ページログイン必須）

## ページ構成
全ページログイン必須（`/auth/*` と `robots.txt` を除く）。「メンバーのみ」は閲覧用アカウントでは入れないページ。
- `/` - ホームページ（各ページへのリンクカード表示）
- `/latest` - 最近の記録（大会ごと。今年度の大会と直近20大会の多い方）
- `/search` - 検索ページ
- `/links` - リンク集
- `/profile` - プロフィール（メンバーのみ）
- `/records` - 自分の記録（メンバーのみ）
- `/records/form` - フォームで記録追加（メンバーのみ）
- `/records/upload` - CSV形式で記録追加（メンバーのみ）
- `/records/edit` - 記録を編集（メンバーのみ）
- `/records/[id]/splits` - ラップ入力（メンバーのみ、自分の記録のみ）
- `/event` - 大会一覧（都道府県コード順）
- `/event/editions` - 開催一覧
- `/event/schedule` - カレンダー（年度・週単位、祝日表示）
- `/event/[id]` - 大会詳細（基本情報・開催回・種目・参加者の記録とラップ）
- `/event/edit-events` - 大会編集（admin のみ）
- `/event/edit-editions` - 開催日編集（admin のみ）
- `/event/edit-races` - 種目編集（admin のみ）

## 設計メモ

### 認証・アクセス制御
- **メンバー限定**: middleware（`lib/supabase/middleware.ts`）で全ページをログイン必須にし、DB 側でも `anon` の読み取りを禁止している（`sql/2026-11-03_members_only.sql`）。画面だけでなく API からも未ログインでは読めない
- **閲覧用共有アカウント**: `viewer@runners-record.local`（`lib/viewer.ts`）、`app_metadata.role = "viewer"`。ログイン画面の「閲覧用パスワード」欄からパスワードのみでログインする。記録・プロフィール・大会編集・パスワード変更には入れず（middleware）、`results`・`result_splits`・`profiles` への書き込みは RESTRICTIVE ポリシーで禁止
- **ユーザー登録**: ブラウザからの新規登録は廃止。管理者が Supabase ダッシュボード（Authentication → Users → Add user）で直接作成する。「Allow new users to sign up」はオフ
- **admin 判定**: `app_metadata.role === "admin"`。編集ページはサーバー側で判定してリダイレクトするが、実際の書き込み制限は RLS（`sql/admin_policies.sql`）
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
- **公開ビュー**: `public_results` に一本化（旧 `public_record`・`public_full_best` など14個は削除済み）
  - `category`（5km / 10km / half / full / 100km / under100 / over100 / time）、`is_best`（利用者×区分のベスト。時間走は距離が長い方）、`has_splits`（ラップ有無）
  - 紐付いた記録は大会名・日付を大会情報から取る（`COALESCE`）。`event_id` で大会詳細へリンク
  - `user_id` は公開しない。所有者権限で動くため Supabase の SECURITY DEFINER 警告は想定どおり
  - `profiles_all`（未登録OBOGの `profiles_pending` を含む）は生年を含むため `anon`・`authenticated` から直接読めないようにしている
  - **ビューを作り直したら** `REVOKE ALL ON public_results FROM anon;` を再実行すること

### その他
- **環境変数**: Supabase のキーは `NEXT_PUBLIC_SUPABASE_ANON_KEY` に統一
- **DB定義**: `sql/` は `.gitignore` 対象（ローカルのみ）。定義を変えたら Supabase の SQL Editor で手動反映する。各ファイルに `_rollback.sql` を用意
- **日時**: `races.entry_start_at` などは TIMESTAMPTZ。表示・入力はブラウザのタイムゾーンで変換する（ISO文字列を切り出すと9時間ずれる）

## 最近の作業履歴

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
