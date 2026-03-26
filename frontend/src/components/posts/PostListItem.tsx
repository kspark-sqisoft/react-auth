import { Link } from "react-router-dom";
import type { Post, PostLikeState } from "@/lib/api";
import { formatDateMediumShort } from "@/lib/format-date";
import { plainTextFromPostHtml } from "@/lib/post-html";
import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { PostLikeButton } from "@/components/posts/PostLikeButton";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";

type Props = {
  post: Post;
  onLikeInteractionStart: () => void;
  onLikeApplied: (postId: number, state: PostLikeState) => void;
  onLikeSyncError: (message: string) => void;
};

export function PostListItem({
  post,
  onLikeInteractionStart,
  onLikeApplied,
  onLikeSyncError,
}: Props) {
  const likeButton = (
    <PostLikeButton
      postId={post.id}
      likeCount={post.likeCount}
      likedByMe={post.likedByMe}
      className="h-8 border border-border/40 bg-background/35 text-foreground shadow-sm backdrop-blur-md hover:bg-background/50"
      onActionStart={onLikeInteractionStart}
      onApplied={(state) => onLikeApplied(post.id, state)}
      onSyncError={onLikeSyncError}
    />
  );

  return (
    <li>
      <Card className="group/card !gap-0 overflow-hidden !p-0 !py-0 transition-colors hover:bg-muted/40">
        <div
          className={
            post.imageUrl
              ? "grid min-h-0 w-full grid-cols-1 sm:grid-cols-[minmax(0,1fr)_7rem] sm:grid-rows-1 sm:items-stretch sm:min-h-[7.5rem]"
              : "grid min-h-0 w-full grid-cols-1 sm:min-h-[7.5rem]"
          }
        >
          <div className="relative isolate min-h-0 min-w-0">
            <Link
              to={`/posts/${post.id}`}
              className={
                post.imageUrl
                  ? "flex h-full min-h-0 min-w-0 flex-col justify-center gap-1.5 px-4 py-3 sm:py-3.5"
                  : "flex h-full min-h-[7.5rem] min-w-0 flex-col justify-center gap-1.5 px-4 py-3 pb-10 pr-14 sm:min-h-0 sm:py-3.5"
              }
            >
              <h3 className="font-heading line-clamp-1 h-6 shrink-0 text-base font-semibold leading-6 text-foreground transition-colors group-hover/card:text-primary">
                {post.title}
              </h3>
              <p className="flex h-8 min-h-8 shrink-0 items-center text-xs text-muted-foreground">
                <AuthorAvatarInline author={post.author} size="xs">
                  {" "}
                  · {formatDateMediumShort(post.createdAt)}
                </AuthorAvatarInline>
              </p>
              <p className="line-clamp-2 h-10 max-h-10 shrink-0 overflow-hidden text-sm leading-5 break-words text-muted-foreground">
                {plainTextFromPostHtml(post.content)}
              </p>
            </Link>
            {!post.imageUrl ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-end p-2">
                <div className="pointer-events-auto">{likeButton}</div>
              </div>
            ) : null}
          </div>
          {post.imageUrl ? (
            <div className="relative isolate h-28 min-h-28 w-full overflow-hidden border-border border-t sm:h-full sm:min-h-0 sm:w-full sm:border-t-0 sm:border-s max-sm:rounded-b-xl sm:rounded-e-xl sm:rounded-b-none">
              <Link
                to={`/posts/${post.id}`}
                className="absolute inset-0 z-0 block overflow-hidden outline-none ring-inset ring-transparent transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${post.title} 상세 보기`}
              >
                <SafeImage
                  src={post.imageUrl}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                  placeholderLabel={`「${post.title}」 대표 이미지`}
                />
              </Link>
              <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-end p-2">
                <div className="pointer-events-auto">{likeButton}</div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </li>
  );
}
