# Runner's Record 開発メモ

## プロジェクト概要
マラソン等大会結果記録・共有ツール
- Next.js + TypeScript + Tailwind CSS
- Supabase（認証・データベース）
- 知人の使用を想定

## ページ構成
- `/` - ホームページ（各ページへのリンクカード表示）
- `/latest` - 最近の記録（直近1年間）
- `/search` - 検索ページ
- `/links` - リンク集
- `/profile` - プロフィール（ログイン必要）
- `/records` - 自分の記録（ログイン必要）
- `/records/form` - フォームで記録追加（ログイン必要）
- `/records/upload` - CSV形式で記録追加（ログイン必要）
- `/records/edit` - 記録を編集（ログイン必要）
- `/event` - 大会一覧（都道府県コード順）
- `/event/editions` - 開催一覧
- `/event/schedule` - カレンダー（年度・週単位、祝日表示）
- `/event/[id]` - 大会詳細（基本情報・開催回・種目）
- `/event/edit-events` - 大会編集（admin のみ）
- `/event/edit-editions` - 開催日編集（admin のみ）
- `/event/edit-races` - 種目編集（admin のみ）

## 設計メモ
- **ユーザー登録**: ブラウザからの新規登録は廃止。管理者が Supabase ダッシュボード（Authentication → Users → Add user）で直接作成する。Supabase 側の「Allow new users to sign up」はオフ
- **公開範囲**: 記録は公開用ビュー（`public_record` など、`user_id` やプロフィール詳細を含まない）で全公開。`results`・`profiles` の元テーブルは非公開
- **admin 判定**: `app_metadata.role === "admin"`。編集ページはサーバー側で判定してリダイレクトするが、実際の書き込み制限は RLS（`sql/admin_policies.sql`）
- **環境変数**: Supabase のキーは `NEXT_PUBLIC_SUPABASE_ANON_KEY` に統一
- **DB定義**: `sql/` は `.gitignore` 対象（ローカルのみ）。定義を変えたら Supabase 側にも手動で反映する
- **日時**: `races.entry_start_at` などは TIMESTAMPTZ。表示・入力はブラウザのタイムゾーンで変換する（ISO文字列を切り出すと9時間ずれる）

## 最近の作業履歴

### 2026-11-03: 大会情報の編集・詳細ページ追加、セキュリティ見直し

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

#### 今後の候補
- `/event`・`/event/editions`・`/event/[id]` をサーバー側でのデータ取得に変更（現在は useEffect でブラウザから取得）
- `app/distance/` はサンプルデータのみの試作ページ（未コミット）

### 2025-11-22: リンク集ページ追加とホームページ改修

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
- ヘッダーメニューの順序: 最近の記録 → 検索 → リンク集 → [ログイン必要なメニュー] → [admin のみ: 大会情報を編集]
- RecordTableのcomment欄でリンクを使う場合は、`[リンクテキスト](URL)`の形式で記述
- コード変更後は `npm run lint` でeslintチェックを実施
