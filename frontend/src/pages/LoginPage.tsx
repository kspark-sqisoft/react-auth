import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation } from "react-router-dom";
import { appLog } from "@/lib/app-log";
import { loginSchema, type LoginFormValues } from "@/lib/schemas/forms";
import { useAuth } from "@/stores/auth-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** 로그인 성공 시 `location.state.from` 또는 기본 `/me`로 이동 */
export function LoginPage() {
  const { user, isReady, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/me";
  const justRegistered = Boolean(
    (location.state as { registered?: boolean } | null)?.registered,
  );

  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    appLog("login", "이미 로그인됨 → 이전 목적지로 이동", { to: from });
    return <Navigate to={from} replace />;
  }

  async function onValid(values: LoginFormValues) {
    setServerError(null);
    setPending(true);
    try {
      await signIn(values.email.trim(), values.password);
      appLog("login", "폼 제출 후 signIn 성공", { redirectTo: from });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      appLog("login", "폼 제출 실패", msg);
      setServerError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>로그인</CardTitle>
          <CardDescription>이메일과 비밀번호를 입력하세요.</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => void handleSubmit(onValid)(e)} noValidate>
          <CardContent className="space-y-4">
            {justRegistered ? (
              <Alert>
                <AlertTitle>가입 완료</AlertTitle>
                <AlertDescription>로그인해 주세요.</AlertDescription>
              </Alert>
            ) : null}
            {serverError ? (
              <Alert variant="destructive">
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="login-email">이메일</Label>
              <Input
                id="login-email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                className={cn(errors.email && "border-destructive")}
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">비밀번호</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                className={cn(errors.password && "border-destructive")}
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? (
                <>
                  <Spinner className="size-4" />
                  진행 중…
                </>
              ) : (
                "로그인"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground sm:text-right">
              계정이 없으신가요?{" "}
              <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
                회원가입
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
