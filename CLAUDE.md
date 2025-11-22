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

## 最近の作業履歴

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
- ヘッダーメニューの順序: 最近の記録 → 検索 → リンク集 → [ログイン必要なメニュー]
- RecordTableのcomment欄でリンクを使う場合は、`[リンクテキスト](URL)`の形式で記述
- コード変更後は `npm run lint` でeslintチェックを実施
