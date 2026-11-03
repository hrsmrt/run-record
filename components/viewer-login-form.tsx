"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VIEWER_EMAIL } from "@/lib/viewer";
import { useState } from "react";

// 閲覧用パスワードだけで、共有の閲覧用アカウントにログインする
export function ViewerLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: VIEWER_EMAIL,
      password,
    });
    if (error) {
      setError("閲覧用パスワードが違います");
      setIsLoading(false);
      return;
    }
    // 先読み済みの「未ログイン時の転送」を使わないよう、ページ全体を読み込み直して移動する
    window.location.assign("/");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">閲覧</CardTitle>
        <CardDescription>閲覧用パスワードを入力してください</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin}>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="viewer-password">閲覧用パスワード</Label>
              <Input
                id="viewer-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "確認中..." : "閲覧する"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
