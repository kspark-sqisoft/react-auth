import axios, { isAxiosError } from "axios";
import { appLog } from "@/lib/app-log";

/**
 * HTTP 클라이언트 및 게시글·인증 관련 API 래퍼.
 * Vite 프록시로 동일 오리진에 붙으며, `withCredentials`로 리프레시 쿠키를 보냅니다.
 */

export const ACCESS_TOKEN_KEY = "access_token";

export type AuthUser = { sub: number; email: string; name: string };

export type PostAuthor = { id: number; name: string };

export type Post = {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
};

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function parseApiErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m))
      return m.filter((x) => typeof x === "string").join(", ");
  }
  return "요청에 실패했습니다.";
}

/** 공통 axios 인스턴스: Bearer(있을 때) + 쿠키 전송 */
export const api = axios.create({
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  /* 브라우저가 multipart boundary를 붙이도록 Content-Type 제거 */
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

export function rethrowAsApiError(e: unknown): never {
  if (isAxiosError(e)) {
    throw new Error(parseApiErrorMessage(e.response?.data));
  }
  if (e instanceof Error) throw e;
  throw new Error("요청에 실패했습니다.");
}

/**
 * 리프레시는 httpOnly 쿠키만 사용(api 인스턴스·Bearer 미사용).
 * 성공 시 sessionStorage에 새 액세스 토큰을 저장합니다.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const { data } = await axios.post<{ access_token?: string }>(
      "/auth/refresh",
      {},
      { withCredentials: true },
    );
    if (!data.access_token) {
      appLog("api", "refresh 실패(토큰 없음)");
      return false;
    }
    setAccessToken(data.access_token);
    appLog("api", "refresh 성공");
    return true;
  } catch {
    appLog("api", "refresh 실패(요청 오류)");
    return false;
  }
}

/** 현재 Bearer로 로그인 사용자 조회; 401 등이면 null */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get<AuthUser>("/users/me");
    return data;
  } catch {
    return null;
  }
}

export type PostsPageResponse = {
  items: Post[];
  total: number;
};

const POST_PAGE_DEFAULT = 5;

/** 공개 글 목록 페이지네이션 (무한 스크롤·더 보기) */
export async function fetchPostsPage(params?: {
  skip?: number;
  take?: number;
}): Promise<PostsPageResponse> {
  try {
    const { data } = await api.get<PostsPageResponse>("/posts", {
      params: {
        skip: params?.skip ?? 0,
        take: params?.take ?? POST_PAGE_DEFAULT,
      },
    });
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export { POST_PAGE_DEFAULT };

/** 단일 글 상세(공개) */
export async function fetchPost(id: number): Promise<Post> {
  try {
    const { data } = await api.get<Post>(`/posts/${id}`);
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

/** Nest multipart 필드와 맞춤: title, content, image, removeImage */
function buildPostFormData(input: {
  title: string;
  content: string;
  image?: File | null;
  removeImage?: boolean;
}): FormData {
  const fd = new FormData();
  fd.append("title", input.title);
  fd.append("content", input.content);
  if (input.image) fd.append("image", input.image);
  if (input.removeImage) fd.append("removeImage", "1");
  return fd;
}

/** JWT 필요; 새 글 생성 후 생성된 Post 반환 */
export async function createPost(input: {
  title: string;
  content: string;
  image?: File | null;
}): Promise<Post> {
  try {
    const { data } = await api.post<Post>(
      "/posts",
      buildPostFormData({
        title: input.title,
        content: input.content,
        image: input.image,
      }),
    );
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

/** JWT·작성자만; PATCH multipart */
export async function updatePost(
  id: number,
  input: {
    title: string;
    content: string;
    image?: File | null;
    removeImage?: boolean;
  },
): Promise<Post> {
  try {
    const { data } = await api.patch<Post>(
      `/posts/${id}`,
      buildPostFormData(input),
    );
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

/** JWT·작성자만 */
export async function deletePost(id: number): Promise<void> {
  try {
    await api.delete(`/posts/${id}`);
  } catch (e) {
    rethrowAsApiError(e);
  }
}
