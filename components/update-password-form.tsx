"use client";

import { cn } from "@/lib/utils";
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
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { finishPasswordChange } from "@/app/auth/update-password/actions";
import { WELCOME_PROFILE_PATH, hasOwnProfile } from "@/lib/after-sign-in";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // 初期パスワードからの変更（middleware が ?first=1 を付けて転送してくる）
  const first = useSearchParams().get("first") === "1";

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // 「初回変更が必要」の印を消し、印のないログイン情報に取り直す（middleware は手元のログイン情報を見るため）
      const finished = await finishPasswordChange();
      if (!finished.ok) throw new Error(finished.error);
      const { data: { user } } = await supabase.auth.refreshSession();
      // プロフィールがまだなければ入力へ案内する
      const next = user && !(await hasOwnProfile(supabase, user.id)) ? WELCOME_PROFILE_PATH : "/profile";
      window.location.assign(next);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      setError(`パスワードの変更に失敗しました${message ? `（${message}）` : ""}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">パスワードの変更</CardTitle>
          <CardDescription>
            {first
              ? "管理者が発行した初期パスワードでログインしています。新しいパスワードを設定してください"
              : "新しいパスワードを入力してください"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">新しいパスワード</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="新しいパスワード"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "保存中..." : "パスワードを変更"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
