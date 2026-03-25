import {
  useActionState,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/stores/auth-store";
import { appLog } from "@/lib/app-log";
import { updateMyProfile } from "@/lib/api";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { FormStatusSubmitButton } from "@/components/forms/FormStatusSubmitButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SafeImage } from "@/components/ui/safe-image";

type ProfileActionState = {
  error: string | null;
  /** 성공 시 증가 — 파일 입력·로컬 미리보기 초기화용 */
  tick: number;
};

/** 로그인 사용자 프로필; 프로필 이미지 업로드·제거 */
export function MyInfoPage() {
  const { user, refreshUser } = useAuth();
  const fileInputId = useId();
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  function releaseLocalPreview() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPickedFile(null);
  }

  const initialState: ProfileActionState = { error: null, tick: 0 };

  async function profileAction(
    prev: ProfileActionState,
    formData: FormData,
  ): Promise<ProfileActionState> {
    const intent = formData.get("intent");
    if (intent === "remove") {
      if (!user?.imageUrl) return { error: null, tick: prev.tick };
      try {
        await updateMyProfile({ removeImage: true });
        await refreshUser();
        appLog("me", "프로필 이미지 제거 완료");
        releaseLocalPreview();
        return { error: null, tick: prev.tick + 1 };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : "제거에 실패했습니다.",
          tick: prev.tick,
        };
      }
    }

    if (intent === "upload") {
      const file = formData.get("image");
      if (!(file instanceof File) || file.size === 0) {
        return { error: "이미지 파일을 선택해 주세요.", tick: prev.tick };
      }
      try {
        await updateMyProfile({ image: file });
        await refreshUser();
        appLog("me", "프로필 이미지 업로드 완료");
        releaseLocalPreview();
        return { error: null, tick: prev.tick + 1 };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : "저장에 실패했습니다.",
          tick: prev.tick,
        };
      }
    }

    return prev;
  }

  const [formState, formAction] = useActionState(profileAction, initialState);
  const [optimisticState, addOptimistic] = useOptimistic(
    formState,
    (current, next: Partial<ProfileActionState>) => ({ ...current, ...next }),
  );

  useEffect(() => {
    appLog("me", "내 정보 화면", user ? { sub: user.sub } : {});
  }, [user]);

  const displayUrl = previewUrl ?? user?.imageUrl ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">내 정보</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          계정 정보와 프로필 이미지를 관리합니다.
        </p>
      </div>

      <FormErrorAlert message={optimisticState.error} />

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
                action={formAction}
                onSubmit={() => addOptimistic({ error: null })}
                className="space-y-3"
              >
                <input type="hidden" name="intent" value="upload" />
                <div className="space-y-2">
                  <Label htmlFor={fileInputId}>이미지 파일</Label>
                  <input
                    key={formState.tick}
                    id={fileInputId}
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
                    onChange={(e) => {
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
                <FormStatusSubmitButton
                  size="sm"
                  disabled={!pickedFile}
                  pendingLabel="처리 중…"
                  spinnerClassName="mr-2"
                >
                  이미지 저장
                </FormStatusSubmitButton>
              </form>

              {user?.imageUrl ? (
                <form
                  action={formAction}
                  onSubmit={() => addOptimistic({ error: null })}
                  className="flex flex-wrap gap-2"
                >
                  <input type="hidden" name="intent" value="remove" />
                  <FormStatusSubmitButton
                    size="sm"
                    variant="outline"
                    pendingLabel="처리 중…"
                    spinnerClassName="mr-2"
                  >
                    이미지 제거
                  </FormStatusSubmitButton>
                </form>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
