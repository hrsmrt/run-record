"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Menu } from "lucide-react";

export function Header() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [mounted, setMounted] = useState(false); // クライアント描画確認
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true); // クライアントでのみ描画

    const supabase = createClient();

    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user && !error) {
        setUser({ id: user.id, email: user.email ?? "" });
      }
    };

    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  // 外側クリックで閉じる
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!mounted) return null; // SSRでは描画しない

  return (
    <header className="flex flex-row items-center justify-between p-4 bg-white border-b border-gray-300 text-black">
      {/* ロゴ */}
      <div className="text-base lg:text-xl font-bold">
        <Link href="/">Runner’s Record</Link>
      </div>

      {/* ナビ */}
      <nav className="flex flex-row lg:flex-row items-center gap-4 md:gap-6 text-base lg:text-xl">

        {/* 自分の記録プルダウン */}
        { (
          <div className="relative" ref={ref}> {/* ここに ref を付与 */}
            <button
              onClick={() => setOpen(!open)}
              className="text-black text-3xl hover:opacity-70"
            ><Menu />
            </button>

            {open && (
              <ul className="absolute mt-2 right-0 bg-white text-black rounded shadow-lg w-48 z-50">
                <li>
                  <Link
                    href="/latest"
                    className="block px-4 py-2 hover:bg-gray-200"
                    onClick={() => setOpen(false)}
                  >
                    最近の記録
                  </Link>
                </li>
                <li>
                  <Link
                    href="/search"
                    className="block px-4 py-2 hover:bg-gray-200"
                    onClick={() => setOpen(false)}
                  >
                    検索
                  </Link>
                </li>
                <li>
                  <Link
                    href="/links"
                    className="block px-4 py-2 hover:bg-gray-200"
                    onClick={() => setOpen(false)}
                  >
                    リンク集
                  </Link>
                </li>
                {user && ( <>
                <li>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 hover:bg-gray-200"
                  >
                    プロフィール
                  </Link>
                </li>
                <li>
                  <Link
                    href="/records"
                    className="block px-4 py-2 hover:bg-gray-200"
                    onClick={() => setOpen(false)}
                  >
                    自分の記録
                  </Link>
                </li>
                <li>
                  <Link
                    href="/records/form"
                    className="block px-4 py-2 hover:bg-gray-200"
                    onClick={() => setOpen(false)}
                  >
                    フォームで記録追加
                  </Link>
                </li>
                <li>
                  <Link
                    href="/records/upload"
                    className="block px-4 py-2 hover:bg-gray-200"
                    onClick={() => setOpen(false)}
                  >
                    CSV形式で記録追加
                  </Link>
                </li>
                <li>
                  <Link
                    href="/records/edit"
                    className="block px-4 py-2 hover:bg-gray-200"
                    onClick={() => setOpen(false)}
                  >
                    記録を編集
                  </Link>
                </li></>)}
                <li>
                  
          {user ? (
            <>
              <button
                onClick={handleLogout}
                className="block px-4 py-2 hover:bg-gray-200"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="block px-4 py-2 hover:bg-gray-200"
            >
              Login
            </Link>
          )}</li>
              </ul>
            )}
            {/* ログイン／ログアウト */}
          </div>
          
        )}
      </nav>
    </header>
  );
}
