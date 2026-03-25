import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { appLog } from "@/lib/app-log";
import { signupSchema, type SignupFormValues } from "@/lib/schemas/forms";
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

/** 가입 API만 호출 후 로그인 화면으로 보내고, `registered` 플래그로 안내 문구 표시 */
export function SignupPage() {
  const { user, isReady, signUp } = useAuth();
  const navigate = useNavigate();

  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    appLog("signup", "이미 로그인됨 → /me");
    return <Navigate to="/me" replace />;
  }

  async function onValid(values: SignupFormValues) {
    setServerError(null);
    setPending(true);
    try {
      await signUp({
        email: values.email.trim(),
        password: values.password,
        name: values.name.trim(),
      });
      appLog("signup", "가입 완료 → 로그인 화면 이동");
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "회원가입에 실패했습니다.";
      appLog("signup", "가입 실패", msg);
      setServerError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>회원가입</CardTitle>
          <CardDescription>새 계정을 만듭니다.</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => void handleSubmit(onValid)(e)} noValidate>
          <CardContent className="space-y-4">
            {serverError ? (
              <Alert variant="destructive">
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="signup-name">이름</Label>
              <Input
                id="signup-name"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                className={cn(errors.name && "border-destructive")}
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">이메일</Label>
              <Input
                id="signup-email"
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
              <Label htmlFor="signup-password">비밀번호</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
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
                "가입하기"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground sm:text-right">
              이미 계정이 있나요?{" "}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                로그인
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
