import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // メンバー限定サイトのため、HTML 以外（画像など）も含めて検索エンジンに登録させない
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
