import { LoginForm } from "@/components/login-form";
import { ViewerLoginForm } from "@/components/viewer-login-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Runner&apos;s Record</h1>
          <p className="text-sm text-gray-500">ホノマラOBOG向け記録共有サイト（非公式）</p>
        </div>
        <ViewerLoginForm />
        <div>
          <p className="mb-2 text-sm text-gray-500">記録を登録するメンバーはこちら</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
