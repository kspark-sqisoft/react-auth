import { useEffect, useId, useState } from "react";
import { useAuth } from "@/stores/auth-store";
import { appLog } from "@/lib/app-log";
import { updateMyProfile } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

/** 로그인 사용자 프로필; 프로필 이미지 업로드·제거 */
export function MyInfoPage() {
  const { user, refreshUser } = useAuth();
  const fileInputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appLog("me", "내 정보 화면", user ? { sub: user.sub } : {});
  }, [user]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const displayUrl = previewUrl ?? user?.imageUrl ?? null;

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({ image: file });
      setFile(null);
      await refreshUser();
      appLog("me", "프로필 이미지 업로드 완료");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!user?.imageUrl) return;
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({ removeImage: true });
      setFile(null);
      await refreshUser();
      appLog("me", "프로필 이미지 제거 완료");
    } catch (e) {
      setError(e instanceof Error ? e.message : "제거에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">내 정보</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          계정 정보와 프로필 이미지를 관리합니다.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

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

      <Card>
        <CardHeader>
          <CardTitle>프로필 이미지</CardTitle>
          <CardDescription>
            JPEG, PNG, GIF, WebP · 최대 2MB. 저장 후 헤더에 원형으로 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt=""
                className="size-24 shrink-0 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div
                className="flex size-24 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-border"
                aria-hidden
              >
                없음
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="space-y-2">
                <Label htmlFor={fileInputId}>이미지 파일</Label>
                <input
                  id={fileInputId}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    setError(null);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !file}
                  onClick={() => void onUpload()}
                >
                  {busy ? (
                    <>
                      <Spinner className="mr-2 size-4" />
                      저장 중…
                    </>
                  ) : (
                    "이미지 저장"
                  )}
                </Button>
                {user?.imageUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void onRemove()}
                  >
                    이미지 제거
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
