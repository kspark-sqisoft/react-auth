/**
 * TanStack Query 키 — 게시글·댓글·사용자 캐시 무효화·공유 시 동일 문자열을 쓰기 위함.
 */
export const userKeys = {
  all: ["users"] as const,
  me: () => [...userKeys.all, "me"] as const,
};

export const postKeys = {
  all: ["posts"] as const,
  lists: () => [...postKeys.all, "list"] as const,
  list: (search: string) => [...postKeys.lists(), search] as const,
  details: () => [...postKeys.all, "detail"] as const,
  /** `viewerKey`: 로그인 시 likedByMe 등이 바뀌므로 구분 */
  detail: (id: number, viewerKey: number | "anon") =>
    [...postKeys.details(), id, viewerKey] as const,
  comments: (postId: number) => [...postKeys.all, postId, "comments"] as const,
};
