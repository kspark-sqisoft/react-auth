import { useEffect } from "react";
import { useAuth } from "@/stores/auth-store";
import { appLog } from "@/lib/app-log";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Zustand에 캐시된 `user`(hydrate·로그인 시 채워짐)를 그대로 표시 */
export function MyInfoPage() {
  const { user } = useAuth();

  useEffect(() => {
    appLog("me", "내 정보 화면", user ? { sub: user.sub } : {});
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">내 정보</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          로그인한 계정입니다.{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /users/me</code> 응답과
          동일합니다.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>계정</CardTitle>
          <CardDescription>현재 로그인 세션의 사용자 식별 값입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-sm">
          <p>
            <span className="text-muted-foreground">sub:</span> {user?.sub}
          </p>
          <p>
            <span className="text-muted-foreground">name:</span> {user?.name}
          </p>
          <p>
            <span className="text-muted-foreground">email:</span> {user?.email}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
