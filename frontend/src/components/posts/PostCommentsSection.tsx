import { useCallback, useEffect, useState } from "react";
import {
  createPostComment,
  deletePostComment,
  fetchPostComments,
  type AuthUser,
  type PostComment,
} from "@/lib/api";
import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { appLog } from "@/lib/app-log";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function formatCommentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type CommentItemProps = {
  postId: number;
  comment: PostComment;
  depth: number;
  user: AuthUser | null;
  onTreeChange: () => void;
  onError: (msg: string) => void;
};

function CommentItem({
  postId,
  comment,
  depth,
  user,
  onTreeChange,
  onError,
}: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = user?.sub === comment.author.id;
  const maxVisualDepth = 14;
  const indent = Math.min(depth, maxVisualDepth);

  async function submitReply() {
    const text = replyBody.trim();
    if (!text || !user) return;
    setBusy(true);
    try {
      await createPostComment(postId, { content: text, parentId: comment.id });
      setReplyBody("");
      setReplyOpen(false);
      onTreeChange();
      appLog("posts", "대댓글 작성", { postId, parentId: comment.id });
    } catch (e) {
      onError(e instanceof Error ? e.message : "댓글을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!user) return;
    setDeleting(true);
    try {
      await deletePostComment(postId, comment.id);
      onTreeChange();
      appLog("posts", "댓글 삭제", { postId, commentId: comment.id });
    } catch (e) {
      onError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="border-l-2 border-border/70 pl-3"
      style={{ marginLeft: indent > 0 ? Math.min(indent, 10) * 12 : 0 }}
    >
      <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AuthorAvatarInline
            author={comment.author}
            size="sm"
            className="text-sm font-medium text-foreground"
          />
          <time
            className="text-xs text-muted-foreground"
            dateTime={comment.createdAt}
          >
            {formatCommentDate(comment.createdAt)}
          </time>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {comment.content}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {user ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setReplyOpen((o) => !o);
                setReplyBody("");
              }}
            >
              답글
            </Button>
          ) : null}
          {isOwner ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
              disabled={deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? "삭제 중…" : "삭제"}
            </Button>
          ) : null}
        </div>
        {replyOpen && user ? (
          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
            <Textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={`${comment.author.name}님에게 답글…`}
              rows={3}
              className="min-h-18 resize-y text-sm"
              disabled={busy}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || !replyBody.trim()}
                onClick={() => void submitReply()}
              >
                {busy ? "등록 중…" : "답글 등록"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setReplyOpen(false);
                  setReplyBody("");
                }}
              >
                취소
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {comment.replies.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {comment.replies.map((r) => (
            <li key={r.id}>
              <CommentItem
                postId={postId}
                comment={r}
                depth={depth + 1}
                user={user}
                onTreeChange={onTreeChange}
                onError={onError}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type PostCommentsSectionProps = {
  postId: number;
  user: AuthUser | null;
};

export function PostCommentsSection({ postId, user }: PostCommentsSectionProps) {
  const [tree, setTree] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [rootBody, setRootBody] = useState("");
  const [rootBusy, setRootBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    void (async () => {
      try {
        const data = await fetchPostComments(postId);
        setTree(data);
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "댓글을 불러오지 못했습니다.";
        setError(msg);
      }
    })();
  }, [postId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await fetchPostComments(postId);
        if (!cancelled) {
          setTree(data);
          setError(null);
          appLog("posts", "댓글 트리 로드", { postId, count: flattenCount(data) });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "댓글을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function submitRoot() {
    const text = rootBody.trim();
    if (!text || !user) return;
    setRootBusy(true);
    try {
      await createPostComment(postId, { content: text });
      setRootBody("");
      reload();
      appLog("posts", "댓글 작성", { postId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "댓글을 저장하지 못했습니다.");
    } finally {
      setRootBusy(false);
    }
  }

  return (
    <section className="border-t border-border pt-8" aria-label="댓글">
      <h2 className="font-heading text-lg font-semibold tracking-tight">댓글</h2>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {user ? (
        <div className="mt-4 space-y-2">
          <Textarea
            value={rootBody}
            onChange={(e) => setRootBody(e.target.value)}
            placeholder="댓글을 입력하세요…"
            rows={4}
            className="min-h-24 resize-y text-sm"
            disabled={rootBusy}
          />
          <Button
            type="button"
            size="sm"
            disabled={rootBusy || !rootBody.trim()}
            onClick={() => void submitRoot()}
          >
            {rootBusy ? "등록 중…" : "댓글 등록"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          댓글을 남기려면 로그인하세요.
        </p>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-7 text-muted-foreground" />
          </div>
        ) : tree.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {tree.map((c) => (
              <li key={c.id}>
                <CommentItem
                  postId={postId}
                  comment={c}
                  depth={0}
                  user={user}
                  onTreeChange={reload}
                  onError={setError}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function flattenCount(nodes: PostComment[]): number {
  let n = 0;
  for (const x of nodes) {
    n += 1 + flattenCount(x.replies);
  }
  return n;
}
