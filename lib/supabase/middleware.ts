import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { VIEWER_ROLE } from "../viewer";
import { MUST_CHANGE_PASSWORD } from "../accounts";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip middleware check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // メンバー限定: /auth/* と robots.txt 以外はログイン必須
  const pathname = request.nextUrl.pathname;
  const isPublic = pathname.startsWith("/auth") || pathname === "/robots.txt";

  if (!isPublic && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // 管理者が作成・再発行した初期パスワードのままなら、変更するまでパスワード変更画面から出さない
  // （/auth/* はログイン・ログアウト・2段階認証のため通す）
  if (user?.app_metadata?.[MUST_CHANGE_PASSWORD] === true && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/update-password";
    url.search = "?first=1";
    return NextResponse.redirect(url);
  }

  // 閲覧用共有アカウントは記録・プロフィール・大会編集・パスワード変更に入れない
  const isViewer = user?.app_metadata?.role === VIEWER_ROLE;
  const viewerBlocked =
    pathname.startsWith("/records") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/event/edit") ||
    pathname.startsWith("/reports/edit") ||
    pathname === "/practices/new" ||
    pathname === "/board/new" ||
    /^\/practices\/\d+\/edit/.test(pathname) ||
    pathname.startsWith("/auth/mfa") ||
    pathname.startsWith("/auth/update-password");
  if (isViewer && viewerBlocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 管理者ページは2段階認証済み（aal2）のセッションのみ。未認証なら登録・入力画面へ
  if (pathname.startsWith("/event/edit") && user?.app_metadata?.role === "admin" && user?.aal !== "aal2") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/mfa";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
