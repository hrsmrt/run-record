import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発サーバーに同じ LAN のスマホなど（192.168.x.x）からアクセスできるようにする（本番には影響しない）
  allowedDevOrigins: ["192.168.*.*"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // メンバー限定サイトのため、HTML 以外（画像など）も含めて検索エンジンに登録させない
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // 他サイトへの埋め込みを禁止（クリックジャッキング対策）
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Content-Type の推測による誤実行を防ぐ
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 外部リンク先に URL のパスやクエリを渡さない
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 使わないブラウザ機能を無効化
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
