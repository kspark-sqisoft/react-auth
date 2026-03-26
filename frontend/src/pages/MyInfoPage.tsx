import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useId, useRef, useState, startTransition } from "react";
import { useAuth } from "@/stores/auth-store";
import { appLog } from "@/lib/app-log";
import { fetchMe, updateMyProfile } from "@/lib/api";
import { userKeys } from "@/lib/query-keys";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeImage } from "@/components/ui/safe-image";
import { Spinner } from "@/components/ui/spinner";

const DISPLAY_NAME_MAX = 100;

/** 로그인 사용자 프로필; 표시 이름·프로필 이미지 */
export function MyInfoPage() {
  const { user, applyServerUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputId = useId();
  const nameInputId = useId();
  const [nameDraft, setNameDraft] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const blobUrlRef = useRef<string | null>(null);

  const {
    data: me,
    isError: meQueryFailed,
    error: meQueryError,
  } = useQuery({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const u = await fetchMe();
      if (!u) throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
      return u;
    },
    enabled: Boolean(user),
    initialData: user ?? undefined,
  });

  const profile = me ?? user;

  useEffect(() => {
    if (profile?.name != null) {
      startTransition(() => setNameDraft(profile.name));
    }
  }, [profile?.name, profile?.sub]);

  function releaseLocalPreview() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPickedFile(null);
  }

  const updateProfile = useMutation({
    mutationFn: (input: {
      name?: string;
      image?: File;
      removeImage?: boolean;
    }) => updateMyProfile(input),
    onSuccess: (next, variables) => {
      queryClient.setQueryData(userKeys.me(), next);
      applyServerUser(next);
      if (variables.image != null || variables.removeImage) {
        releaseLocalPreview();
        setFileKey((k) => k + 1);
      }
      appLog("me", "프로필 반영 완료", { sub: next.sub });
      if (variables.name != null) toast.success("표시 이름을 저장했습니다.");
      else if (variables.image != null) toast.success("프로필 이미지를 저장했습니다.");
      else if (variables.removeImage) toast.success("프로필 이미지를 제거했습니다.");
    },
    onError: (e) => {
      const msg =
        e instanceof Error ? e.message : "프로필을 저장하지 못했습니다.";
      toast.error(msg);
    },
  });

  useEffect(() => {
    appLog("me", "내 정보 화면", profile ? { sub: profile.sub } : {});
  }, [profile]);

  useEffect(() => {
    if (!meQueryFailed) return;
    const msg =
      meQueryError instanceof Error
        ? meQueryError.message
        : "프로필을 불러오지 못했습니다.";
    toast.error(msg);
  }, [meQueryFailed, meQueryError]);

  const displayUrl = previewUrl ?? profile?.imageUrl ?? null;

  const meErrMsg =
    meQueryFailed && meQueryError instanceof Error
      ? meQueryError.message
      : meQueryFailed
        ? "프로필을 불러오지 못했습니다."
        : null;

  const errMsg =
    updateProfile.error instanceof Error
      ? updateProfile.error.message
      : updateProfile.isError
        ? "요청에 실패했습니다."
        : null;

  const alertMessage = meErrMsg ?? errMsg;

  const busy = updateProfile.isPending;

  const nameTrimmed = nameDraft.trim();
  const nameLenOk =
    nameTrimmed.length > 0 && nameTrimmed.length <= DISPLAY_NAME_MAX;
  const nameDirty =
    nameTrimmed !== (profile?.name ?? "").trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">내 정보</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          표시 이름·프로필 이미지를 변경할 수 있습니다.
        </p>
      </div>

      <FormErrorAlert message={alertMessage} />

      <Card>
        <CardHeader>
          <CardTitle>계정</CardTitle>
          <CardDescription>현재 로그인 세션의 사용자 식별 값입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-sm">
          <p>
            <span className="text-muted-foreground">sub:</span> {profile?.sub}
          </p>
          <p>
            <span className="text-muted-foreground">email:</span> {profile?.email}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>표시 이름</CardTitle>
          <CardDescription>
            글 작성자·댓글·헤더 등에 보이는 이름입니다. 최대 {DISPLAY_NAME_MAX}자입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.reset();
              if (!nameLenOk || !nameDirty) return;
              updateProfile.mutate({ name: nameTrimmed });
            }}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor={nameInputId}>이름</Label>
              <Input
                id={nameInputId}
                name="displayName"
                maxLength={DISPLAY_NAME_MAX}
                value={nameDraft}
                onChange={(e) => {
                  updateProfile.reset();
                  setNameDraft(e.target.value);
                }}
                autoComplete="nickname"
                aria-invalid={nameDraft.trim().length > DISPLAY_NAME_MAX}
              />
              {nameDraft.length > DISPLAY_NAME_MAX ? (
                <p className="text-xs text-destructive">
                  {DISPLAY_NAME_MAX}자 이하로 입력해 주세요.
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              size="sm"
              className="shrink-0"
              disabled={!nameLenOk || !nameDirty || busy}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4 shrink-0" />
                  저장 중…
                </span>
              ) : (
                "이름 저장"
              )}
            </Button>
          </form>
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
              <SafeImage
                src={displayUrl}
                alt=""
                className="size-24 shrink-0 rounded-full object-cover ring-2 ring-border"
                placeholderLabel="프로필 이미지"
                fallback={
                  <div
                    className="flex size-24 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-border"
                    aria-hidden
                  >
                    없음
                  </div>
                }
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
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateProfile.reset();
                  if (!pickedFile) return;
                  updateProfile.mutate({ image: pickedFile });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor={fileInputId}>이미지 파일</Label>
                  <input
                    key={fileKey}
                    id={fileInputId}
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
                    onChange={(e) => {
                      updateProfile.reset();
                      releaseLocalPreview();
                      const f = e.target.files?.[0] ?? null;
                      if (f) {
                        const u = URL.createObjectURL(f);
                        blobUrlRef.current = u;
                        setPreviewUrl(u);
                        setPickedFile(f);
                      }
                    }}
                  />
                </div>
                <Button type="submit" size="sm" disabled={!pickedFile || busy}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="mr-2 size-4 shrink-0" />
                      처리 중…
                    </span>
                  ) : (
                    "이미지 저장"
                  )}
                </Button>
              </form>

              {profile?.imageUrl ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      updateProfile.reset();
                      updateProfile.mutate({ removeImage: true });
                    }}
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="mr-2 size-4 shrink-0" />
                        처리 중…
                      </span>
                    ) : (
                      "이미지 제거"
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
