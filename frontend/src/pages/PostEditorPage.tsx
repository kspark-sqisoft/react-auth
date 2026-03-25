import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { createPost, fetchPost, updatePost } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { postEditorSchema, type PostEditorFormValues } from "@/lib/schemas/forms";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** `/posts/new` 또는 `/posts/:id/edit`; 로그인·작성자 검증 후 multipart 저장 */
export function PostEditorPage() {
  const { id: idParam } = useParams();
  const isEdit = idParam !== undefined;
  const postId = idParam ? Number(idParam) : NaN;

  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [pending, setPending] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PostEditorFormValues>({
    resolver: zodResolver(postEditorSchema),
    defaultValues: { title: "", content: "" },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isEdit || !Number.isFinite(postId)) {
      setLoading(false);
      reset({ title: "", content: "" });
      setExistingImageUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const post = await fetchPost(postId);
        if (cancelled) return;
        if (user && post.author.id !== user.sub) {
          appLog("posts", "수정 권한 없음 — 상세로 이동", { postId });
          setForbidden(true);
          return;
        }
        reset({ title: post.title, content: post.content });
        setExistingImageUrl(post.imageUrl);
        appLog("posts", "에디터 기존 글 로드", { postId });
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "글을 불러오지 못했습니다.";
          appLog("posts", "에디터 로드 실패", { postId, msg });
          setLoadError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, postId, user, reset]);

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
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
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

  async function onValid(values: PostEditorFormValues) {
    setSubmitError(null);
    setPending(true);
    try {
      if (isEdit) {
        const updated = await updatePost(postId, {
          title: values.title.trim(),
          content: values.content,
          image: imageFile ?? undefined,
          removeImage: removeExistingImage && !imageFile,
        });
        appLog("posts", "글 수정 저장", { id: updated.id });
        navigate(`/posts/${updated.id}`, { replace: true });
      } else {
        const created = await createPost({
          title: values.title.trim(),
          content: values.content,
          image: imageFile ?? undefined,
        });
        appLog("posts", "글 작성 저장", { id: created.id });
        navigate(`/posts/${created.id}`, { replace: true });
      }
    } catch (err) {
      appLog("posts", "저장 실패", err instanceof Error ? err.message : err);
      setSubmitError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
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
        <form onSubmit={(e) => void handleSubmit(onValid)(e)} noValidate>
          <CardHeader>
            <CardTitle>내용</CardTitle>
            <CardDescription>저장 시 즉시 반영됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitError ? (
              <Alert variant="destructive">
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="post-title">제목</Label>
              <Input
                id="post-title"
                maxLength={200}
                aria-invalid={Boolean(errors.title)}
                className={cn(errors.title && "border-destructive")}
                {...register("title")}
              />
              {errors.title ? (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-content">본문</Label>
              <Textarea
                id="post-content"
                rows={12}
                className={cn("min-h-48", errors.content && "border-destructive")}
                aria-invalid={Boolean(errors.content)}
                {...register("content")}
              />
              {errors.content ? (
                <p className="text-sm text-destructive">{errors.content.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-image">이미지 (선택)</Label>
              <Input
                id="post-image"
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
                  <img
                    src={displayImageSrc}
                    alt=""
                    className="max-h-64 w-full object-contain"
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
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner className="size-4" />
                  저장 중…
                </>
              ) : (
                "저장"
              )}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to={isEdit ? `/posts/${postId}` : "/posts"}>취소</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
