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
  title: "マラソン記録ツール developed by H.Murata",
  description: "",
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
    <html lang="en" suppressHydrationWarning>
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
          <p>マラソン等大会結果記録・共有ツールです。知人の使用を想定しています。ユーザー登録には認証パスワードが必要です。お問い合わせは村田(メール: <ObfuscatedEmail />)までお願いします。</p>
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
