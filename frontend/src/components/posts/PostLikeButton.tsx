import { useState, type MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/stores/auth-store";
import { likePost, unlikePost, type PostLikeState } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  postId: number;
  likeCount: number;
  likedByMe: boolean;
  onApplied: (state: PostLikeState) => void;
  onPatch: (patch: PostLikeState) => void;
  onSyncError?: (message: string) => void;
  size?: "sm" | "default";
  className?: string;
};

/** 낙관적 UI: 클릭 즉시 반영 후 API 실패 시 onPatch로 이전 값 복구 */
export function PostLikeButton({
  postId,
  likeCount,
  likedByMe,
  onApplied,
  onPatch,
  onSyncError,
  size = "sm",
  className,
}: Props) {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  async function toggle(ev: MouseEvent<HTMLButtonElement>) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!user || pending) return;

    const nextLiked = !likedByMe;
    const nextCount = likeCount + (nextLiked ? 1 : -1);
    const snapshot: PostLikeState = { likeCount, likedByMe };

    onPatch({ likeCount: nextCount, likedByMe: nextLiked });
    setPending(true);
    try {
      const state = nextLiked ? await likePost(postId) : await unlikePost(postId);
      onApplied(state);
    } catch (e) {
      onPatch(snapshot);
      const msg = e instanceof Error ? e.message : "좋아요 처리에 실패했습니다.";
      onSyncError?.(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={likedByMe ? "secondary" : "ghost"}
      size={size}
      disabled={!user || pending}
      className={cn("gap-1.5", className)}
      aria-pressed={likedByMe}
      aria-label={likedByMe ? "좋아요 취소" : "좋아요"}
      title={user ? undefined : "로그인 후 좋아요할 수 있습니다."}
      onClick={toggle}
    >
      <Heart
        className={cn("size-4 shrink-0", likedByMe && "fill-primary text-primary")}
        aria-hidden
      />
      <span className="tabular-nums text-xs font-medium">{likeCount}</span>
    </Button>
  );
}
