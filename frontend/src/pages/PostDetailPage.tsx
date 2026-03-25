import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { deletePost, fetchPost, type Post } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { PostLikeButton } from "@/components/posts/PostLikeButton";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** 공개 상세; 작성자에게만 수정·삭제 버튼 */
export function PostDetailPage() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : NaN;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError("잘못된 글 번호입니다.");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchPost(id);
        if (!cancelled) {
          setPost(p);
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

  const isOwner = user && post && user.sub === post.author.id;

  async function onDelete() {
    if (!Number.isFinite(id)) return;
    setDeleting(true);
    try {
      await deletePost(id);
      appLog("posts", "글 삭제 완료", { id });
      setDeleteOpen(false);
      navigate("/posts", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  if (error && !post) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" size="sm">
          <Link to="/posts">목록으로</Link>
        </Button>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <article className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{post.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {post.author.name} · {formatDate(post.createdAt)}
          </p>
          <div className="mt-3">
            <PostLikeButton
              postId={post.id}
              likeCount={post.likeCount}
              likedByMe={post.likedByMe}
              onPatch={(patch) =>
                setPost((p) => (p ? { ...p, ...patch } : p))
              }
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
          <img
            src={post.imageUrl}
            alt=""
            className="max-h-[min(70vh,560px)] w-auto max-w-full object-contain object-center"
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="whitespace-pre-wrap border-t border-border pt-6 text-sm leading-relaxed">
        {post.content}
      </div>

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
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
