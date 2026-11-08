import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Header } from "@/components/header";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Runner’s Record",
  description: "ホノマラOBOG向け記録共有サイト（非公式）",
  // メンバー限定サイトのため検索エンジンに登録させない
  robots: { index: false, follow: false, nocache: true },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export function ObfuscatedEmail() {
  const user = "hiro979mrta";
  const domain = "gmail";
  const tld = "com";

  const email = `${user}@${domain}.${tld}`;

  return <a href={`mailto:${email}`}>{email}</a>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          {children}
        </ThemeProvider>
        <footer className="w-full flex flex-col md:flex-row items-center justify-center text-center text-xs py-16 gap-2 md:gap-8 border-t mx-auto">
          <div className="space-y-2">
          <p>ホノマラOBOG のマラソン等の大会結果を記録・共有する、メンバー限定のサイト（非公式）です。管理者が知り得た範囲で掲載しています。</p>
          <p>大会情報は確認済みのものを掲載していますが、誤りがある可能性もあるため、公式情報もご確認ください。誤りや掲載してほしい大会があればご連絡ください。</p>
          <p>記録は本人・幹事が大会の公式結果をもとに入力しています。</p>
          <p>お問い合わせは村田(メール: <ObfuscatedEmail />)までお願いします。</p>
          <p>
            Powered by{" "}
            <a
              href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
              target="_blank"
              className="font-bold hover:underline"
              rel="noreferrer"
            >
              Supabase
            </a>
          </p>
          </div>
          <ThemeSwitcher />
        </footer>
      </body>
    </html>
  );
}
