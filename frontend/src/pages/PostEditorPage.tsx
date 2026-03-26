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
import { PostRichEditor } from "@/components/posts/PostRichEditor";
import { captureVideoPosterJpeg } from "@/lib/video-poster";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function fileAttachmentKind(f: File): "image" | "video" | null {
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("video/")) return "video";
  const n = f.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp)$/i.test(n)) return "image";
  if (/\.(mp4|webm|mov)$/i.test(n)) return "video";
  return null;
}

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
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [existingVideoPosterUrl, setExistingVideoPosterUrl] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPosterFile, setVideoPosterFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [posterObjectUrl, setPosterObjectUrl] = useState<string | null>(null);
  const [removeExistingMedia, setRemoveExistingMedia] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);

  const [forbidden, setForbidden] = useState(false);

  const [title, setTitle] = useState("");

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
          video: videoFile ?? undefined,
          videoPoster: videoPosterFile ?? undefined,
          removeMedia: isEdit && removeExistingMedia && !imageFile && !videoFile,
        });
        queryClient.setQueryData(postKeys.detail(updated.id, viewerKey), updated);
        void queryClient.invalidateQueries({ queryKey: postKeys.lists() });
        appLog("posts", "글 수정 저장", { id: updated.id });
        toast.success("글이 수정되었습니다.");
        return { serverError: null, fieldErrors: {}, redirectTo: `/posts/${updated.id}` };
      }

      const created = await createPost({
        title: parsed.data.title.trim(),
        content: parsed.data.content,
        image: imageFile ?? undefined,
        video: videoFile ?? undefined,
        videoPoster: videoPosterFile ?? undefined,
      });
      void queryClient.invalidateQueries({ queryKey: postKeys.all });
      appLog("posts", "글 작성 저장", { id: created.id });
      toast.success("글이 등록되었습니다.");
      return { serverError: null, fieldErrors: {}, redirectTo: `/posts/${created.id}` };
    } catch (err) {
      appLog("posts", "저장 실패", err instanceof Error ? err.message : err);
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다.";
      toast.error(msg);
      return {
        serverError: msg,
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

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (posterObjectUrl) URL.revokeObjectURL(posterObjectUrl);
    };
  }, [posterObjectUrl]);

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

  useEffect(() => {
    if (!isEdit || !Number.isFinite(postId) || !isError) return;
    const msg =
      postQueryError instanceof Error
        ? postQueryError.message
        : "글을 불러오지 못했습니다.";
    toast.error(msg);
  }, [isEdit, postId, isError, postQueryError]);

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
        setExistingImageUrl(null);
        setExistingVideoUrl(null);
        setExistingVideoPosterUrl(null);
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
      setExistingImageUrl(loadedPost.imageUrl);
      setExistingVideoUrl(loadedPost.videoUrl);
      setExistingVideoPosterUrl(loadedPost.videoPosterUrl);
      setRemoveExistingMedia(false);
    });
  }, [isEdit, postId, loadedPost, postLoading, user]);

  function clearAttachment() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPosterObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImageFile(null);
    setVideoFile(null);
    setVideoPosterFile(null);
    if (isEdit) setRemoveExistingMedia(true);
  }

  async function onPickAttachment(file: File | null) {
    if (!file) {
      clearAttachment();
      return;
    }
    const kind = fileAttachmentKind(file);
    if (!kind) {
      toast.error(
        "JPEG, PNG, GIF, WebP 이미지 또는 MP4, WebM, MOV 동영상만 선택할 수 있습니다.",
      );
      return;
    }
    setRemoveExistingMedia(false);

    if (kind === "image") {
      setVideoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPosterObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setVideoFile(null);
      setVideoPosterFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setImageFile(file);
      return;
    }

    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImageFile(null);
    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPosterObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVideoFile(file);
    setVideoPosterFile(null);
    setPosterBusy(true);
    try {
      const poster = await captureVideoPosterJpeg(file);
      setVideoPosterFile(poster);
      if (poster) setPosterObjectUrl(URL.createObjectURL(poster));
    } finally {
      setPosterBusy(false);
    }
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

  const displayImageSrc = previewUrl
    ? previewUrl
    : !removeExistingMedia && !imageFile && !videoFile
      ? existingImageUrl
      : null;

  const displayVideoSrc = videoPreviewUrl
    ? videoPreviewUrl
    : !removeExistingMedia && !imageFile && !videoFile
      ? existingVideoUrl
      : null;

  const displayVideoPoster =
    posterObjectUrl ??
    (!removeExistingMedia && !imageFile && !videoFile ? existingVideoPosterUrl : null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {isEdit ? "글 수정" : "글 작성"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          제목·리치 텍스트 본문·선택 첨부 1개(이미지 최대 5MB 또는 동영상 MP4/WebM/MOV 최대 80MB)만 등록할 수 있습니다. 동영상은
          가능하면 자동으로 목록용 썸네일을 만듭니다.
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
          <CardContent className="space-y-4 pb-6">
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
              <Label>본문</Label>
              <PostRichEditor
                key={isEdit && Number.isFinite(postId) ? `edit-${postId}` : "new"}
                initialHtml={isEdit && loadedPost ? loadedPost.content : ""}
                invalid={Boolean(optimisticState.fieldErrors.content)}
              />
              <FormFieldError message={optimisticState.fieldErrors.content} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-attachment">첨부 파일 (선택, 이미지 또는 동영상 1개)</Label>
              <Input
                id="post-attachment"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                className="cursor-pointer text-sm"
                disabled={posterBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  void onPickAttachment(f);
                }}
              />
              {posterBusy ? (
                <p className="text-xs text-muted-foreground">동영상에서 썸네일을 만드는 중…</p>
              ) : null}
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
                      clearAttachment();
                      const input = document.getElementById("post-attachment") as HTMLInputElement | null;
                      if (input) input.value = "";
                    }}
                  >
                    첨부 제거
                  </Button>
                </div>
              ) : displayVideoSrc ? (
                <div className="relative mt-2 overflow-hidden rounded-lg border border-border bg-muted/30">
                  <video
                    src={displayVideoSrc}
                    controls
                    playsInline
                    className="max-h-64 w-full object-contain"
                    poster={displayVideoPoster ?? undefined}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute end-2 top-2"
                    onClick={() => {
                      clearAttachment();
                      const input = document.getElementById("post-attachment") as HTMLInputElement | null;
                      if (input) input.value = "";
                    }}
                  >
                    첨부 제거
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
