import { useEffect, useState, useTransition } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { deletePost, fetchPost, type Post } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { PostLikeButton } from "@/components/posts/PostLikeButton";
import { PostCommentsSection } from "@/components/posts/PostCommentsSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { formatDateFullShort } from "@/lib/format-date";

/** 공개 상세; 작성자에게만 수정·삭제 버튼 */
export function PostDetailPage() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : NaN;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchPost(id);
        if (!cancelled) {
          setPost(p);
          setError(null);
          appLog("posts", "상세 로드 완료", { id: p.id });
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "글을 불러오지 못했습니다.";
          appLog("posts", "상세 로드 실패", { id, msg });
          setError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.sub]);

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message="잘못된 글 번호입니다." />
        <Button asChild variant="outline" size="sm">
          <Link to="/posts">목록으로</Link>
        </Button>
      </div>
    );
  }

  const isOwner = user && post && user.sub === post.author.id;

  function onDelete() {
    if (!Number.isFinite(id)) return;
    startDeleteTransition(async () => {
      try {
        await deletePost(id);
        appLog("posts", "글 삭제 완료", { id });
        setDeleteOpen(false);
        navigate("/posts", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      }
    });
  }

  if (error && !post) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message={error} />
        <Button asChild variant="outline" size="sm">
          <Link to="/posts">목록으로</Link>
        </Button>
      </div>
    );
  }

  if (!post) {
    return <CenteredSpinner className="min-h-0 py-16" />;
  }

  return (
    <article className="space-y-6">
      <FormErrorAlert message={error} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{post.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <AuthorAvatarInline author={post.author} size="md">
              {" "}
              · {formatDateFullShort(post.createdAt)}
            </AuthorAvatarInline>
          </p>
          <div className="mt-3">
            <PostLikeButton
              postId={post.id}
              likeCount={post.likeCount}
              likedByMe={post.likedByMe}
              onApplied={(state) =>
                setPost((p) =>
                  p ? { ...p, likeCount: state.likeCount, likedByMe: state.likedByMe } : p,
                )
              }
              onSyncError={(msg) => setError(msg)}
            />
          </div>
        </div>
        {isOwner ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/posts/${post.id}/edit`}>수정</Link>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              삭제
            </Button>
          </div>
        ) : null}
      </div>

      {post.imageUrl ? (
        <div className="flex w-full justify-center rounded-xl border border-border bg-muted/20 px-2 py-3 sm:px-3 sm:py-4">
          <SafeImage
            src={post.imageUrl}
            alt=""
            className="max-h-[min(70vh,560px)] min-h-36 w-auto max-w-full object-contain object-center sm:min-h-48"
            loading="lazy"
            placeholderLabel="글 본문 이미지"
          />
        </div>
      ) : null}

      <div className="whitespace-pre-wrap border-t border-border pt-6 text-sm leading-relaxed">
        {post.content}
      </div>

      <PostCommentsSection postId={post.id} user={user} />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-0"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            navigate(-1);
          } else {
            navigate("/posts");
          }
        }}
      >
        ← 목록
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 글을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              disabled={isDeletePending}
            >
              {isDeletePending ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
