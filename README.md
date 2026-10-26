# ヒカマーズ総裁選・予選サイト（14候補）
未公開スターターです。まだデプロイされていません。
- index.html: 14候補の投票画面と集計
- functions/api/vote.js: 日本時間の日付ごとにIP由来HMACで1日1票を制限
- functions/api/results.js: 集計API
- schema.sql: D1テーブルと14候補登録

Cloudflare手順：ZIPを解凍してGitHubへアップロード→Cloudflare Workers & PagesでGit連携のPagesを作成→D1を作成しschema.sqlを実行→Pages SettingsのD1 bindingsで変数名DBとして接続→Variables and SecretsにIP_HASH_SECRETを設定→デプロイ後に投票・二重投票・集計をテスト。

注意：IP制限は本人確認ではありません。同じWi-Fiの利用者が制限を共有する可能性があり、VPNや回線変更で回避される場合もあります。公開前に実環境でテストしてください。生IPはD1に保存せず、日付とIPから作ったHMAC値を保存します。