import type { MetadataRoute } from "next"

// メンバー限定サイトのため、すべてのクローラーを拒否
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  }
}
