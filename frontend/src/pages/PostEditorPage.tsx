import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useActionState,
  useEffect,
  useOptimistic,
  useState,
  startTransition,
} from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { createPost, fetchPost, updatePost } from "@/lib/api";
import { postKeys } from "@/lib/query-keys";
import { appLog } from "@/lib/app-log";
import { formDataGetString } from "@/lib/form-data-utils";
import { fieldErrorsFromZodIssues } from "@/lib/zod-form";
import { postEditorSchema, type PostEditorFormValues } from "@/lib/schemas/forms";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { FormFieldError } from "@/components/forms/FormFieldError";
import { FormStatusSubmitButton } from "@/components/forms/FormStatusSubmitButton";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
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
import { SafeImage } from "@/components/ui/safe-image";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PostEditorActionState = {
  serverError: string | null;
  fieldErrors: Partial<Record<keyof PostEditorFormValues, string>>;
  redirectTo: string | null;
};

/** `/posts/new` 또는 `/posts/:id/edit`; 로그인·작성자 검증 후 multipart 저장 */
export function PostEditorPage() {
  const { id: idParam } = useParams();
  const isEdit = idParam !== undefined;
  const postId = idParam ? Number(idParam) : NaN;

  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const viewerKey = user?.sub ?? "anon";

  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const [forbidden, setForbidden] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const initialState: PostEditorActionState = {
    serverError: null,
    fieldErrors: {},
    redirectTo: null,
  };

  async function postEditorAction(
    _prevState: PostEditorActionState,
    formData: FormData,
  ): Promise<PostEditorActionState> {
    const parsed = postEditorSchema.safeParse({
      title: formDataGetString(formData, "title"),
      content: formDataGetString(formData, "content"),
    });
    if (!parsed.success) {
      return {
        serverError: null,
        fieldErrors: fieldErrorsFromZodIssues<keyof PostEditorFormValues>(parsed.error.issues),
        redirectTo: null,
      };
    }

    try {
      if (isEdit) {
        const updated = await updatePost(postId, {
          title: parsed.data.title.trim(),
          content: parsed.data.content,
          image: imageFile ?? undefined,
          removeImage: removeExistingImage && !imageFile,
        });
        queryClient.setQueryData(postKeys.detail(updated.id, viewerKey), updated);
        void queryClient.invalidateQueries({ queryKey: postKeys.lists() });
        appLog("posts", "글 수정 저장", { id: updated.id });
        return { serverError: null, fieldErrors: {}, redirectTo: `/posts/${updated.id}` };
      }

      const created = await createPost({
        title: parsed.data.title.trim(),
        content: parsed.data.content,
        image: imageFile ?? undefined,
      });
      void queryClient.invalidateQueries({ queryKey: postKeys.all });
      appLog("posts", "글 작성 저장", { id: created.id });
      return { serverError: null, fieldErrors: {}, redirectTo: `/posts/${created.id}` };
    } catch (err) {
      appLog("posts", "저장 실패", err instanceof Error ? err.message : err);
      return {
        serverError: err instanceof Error ? err.message : "저장에 실패했습니다.",
        fieldErrors: {},
        redirectTo: null,
      };
    }
  }

  const [formState, formAction] = useActionState(postEditorAction, initialState);
  const [optimisticState, addOptimistic] = useOptimistic(
    formState,
    (current, next: Partial<PostEditorActionState>) => ({ ...current, ...next }),
  );

  useEffect(() => {
    if (!optimisticState.redirectTo) return;
    navigate(optimisticState.redirectTo, { replace: true });
  }, [optimisticState.redirectTo, navigate]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const {
    data: loadedPost,
    isPending: postLoading,
    isError,
    error: postQueryError,
  } = useQuery({
    queryKey: postKeys.detail(postId, viewerKey),
    queryFn: async () => {
      const post = await fetchPost(postId);
      appLog("posts", "에디터 기존 글 로드", { postId });
      return post;
    },
    enabled: isEdit && Number.isFinite(postId),
  });

  const loadError =
    isEdit && isError
      ? postQueryError instanceof Error
        ? postQueryError.message
        : "글을 불러오지 못했습니다."
      : null;

  useEffect(() => {
    startTransition(() => {
      if (!isEdit || !Number.isFinite(postId)) {
        setTitle("");
        setContent("");
        setExistingImageUrl(null);
        setForbidden(false);
        return;
      }
      if (postLoading || !loadedPost) return;
      if (user && loadedPost.author.id !== user.sub) {
        appLog("posts", "수정 권한 없음 — 상세로 이동", { postId });
        setForbidden(true);
        return;
      }
      setForbidden(false);
      setTitle(loadedPost.title);
      setContent(loadedPost.content);
      setExistingImageUrl(loadedPost.imageUrl);
    });
  }, [isEdit, postId, loadedPost, postLoading, user]);

  function onPickImage(file: File | null) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setImageFile(file);
    if (file) setRemoveExistingImage(false);
  }

  function clearImage() {
    onPickImage(null);
    if (isEdit) setRemoveExistingImage(true);
  }

  if (!isReady) {
    return <CenteredSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (forbidden) {
    return <Navigate to={`/posts/${postId}`} replace />;
  }

  if (isEdit && !Number.isFinite(postId)) {
    return <Navigate to="/posts" replace />;
  }

  if (isEdit && postLoading) {
    return <CenteredSpinner className="min-h-0 py-16" />;
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message={loadError} />
        <Button asChild variant="outline" size="sm">
          <Link to="/posts">목록으로</Link>
        </Button>
      </div>
    );
  }

  const displayImageSrc = previewUrl ?? (removeExistingImage ? null : existingImageUrl);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {isEdit ? "글 수정" : "글 작성"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          제목·본문·선택 이미지(JPEG, PNG, GIF, WebP, 최대 5MB)를 등록할 수 있습니다.
        </p>
      </div>

      <Card>
        <form
          action={formAction}
          onSubmit={() => addOptimistic({ serverError: null, fieldErrors: {} })}
          noValidate
        >
          <CardHeader>
            <CardTitle>내용</CardTitle>
            <CardDescription>저장 시 즉시 반영됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormErrorAlert message={optimisticState.serverError} />
            <div className="space-y-2">
              <Label htmlFor="post-title">제목</Label>
              <Input
                id="post-title"
                name="title"
                maxLength={200}
                aria-invalid={Boolean(optimisticState.fieldErrors.title)}
                className={cn(optimisticState.fieldErrors.title && "border-destructive")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <FormFieldError message={optimisticState.fieldErrors.title} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-content">본문</Label>
              <Textarea
                id="post-content"
                name="content"
                rows={12}
                className={cn("min-h-48", optimisticState.fieldErrors.content && "border-destructive")}
                aria-invalid={Boolean(optimisticState.fieldErrors.content)}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <FormFieldError message={optimisticState.fieldErrors.content} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-image">이미지 (선택)</Label>
              <Input
                id="post-image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="cursor-pointer text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  onPickImage(f);
                }}
              />
              {displayImageSrc ? (
                <div className="relative mt-2 overflow-hidden rounded-lg border border-border bg-muted/30">
                  <SafeImage
                    src={displayImageSrc}
                    alt=""
                    className="max-h-64 w-full object-contain"
                    placeholderLabel="첨부 이미지 미리보기"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute end-2 top-2"
                    onClick={() => {
                      clearImage();
                      const input = document.getElementById("post-image") as HTMLInputElement | null;
                      if (input) input.value = "";
                    }}
                  >
                    이미지 제거
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30">
            <FormStatusSubmitButton pendingLabel="저장 중…">저장</FormStatusSubmitButton>
            <Button type="button" variant="outline" asChild>
              <Link to={isEdit ? `/posts/${postId}` : "/posts"}>취소</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
