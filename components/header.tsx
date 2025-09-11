"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export function Header() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [name, setName] = useState<string>("");
  const [mounted, setMounted] = useState(false); // クライアント描画確認
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true); // クライアントでのみ描画

    const supabase = createClient();

    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user && !error) {
        setUser({ id: user.id, email: user.email ?? "" });

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", user.id)
          .single();

        if (!profileError && profile) {
          setName(profile.name);
        }
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
    setName("");
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
      <div className="text-[12px] lg:text-xl font-bold">
        <Link href="/">マラソン記録ツール developed by H.Murata</Link>
      </div>

      {/* ナビ */}
      <nav className="flex flex-row lg:flex-row items-center gap-4 md:gap-6 text-[12px] lg:text-xl">
        <Link href="./">HOME</Link>

        {/* 自分の記録プルダウン */}
        {user && (
          <div className="relative" ref={ref}> {/* ここに ref を付与 */}
            <button
              onClick={() => setOpen(!open)}
              className="hover:underline focus:outline-none"
            >
              自己記録 ▼
            </button>

            {open && (
              <ul className="absolute mt-2 right-0 bg-white text-black rounded shadow-lg w-48 z-50">
                <li>
                  <Link
                    href="/records"
                    className="block px-4 py-2 hover:bg-gray-200"
                    onClick={() => setOpen(false)}
                  >
                    表示
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
                </li>
              </ul>
            )}
          </div>
        )}

        {/* ログイン／ログアウト */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span>
                <Link
                  href="/profile"
                  className="mr-2 font-semibold hover:underline"
                >
                  {name || user.email}
                </Link>
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-black text-white rounded hover:bg-black"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
