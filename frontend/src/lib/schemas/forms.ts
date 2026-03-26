import { z } from "zod";

/** 로그인 */
export const loginSchema = z.object({
  email: z.pipe(
    z.string().min(1, "이메일을 입력해 주세요."),
    z.email("이메일 형식이 올바르지 않습니다."),
  ),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/** 회원가입 */
export const signupSchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요."),
  email: z.pipe(
    z.string().min(1, "이메일을 입력해 주세요."),
    z.email("이메일 형식이 올바르지 않습니다."),
  ),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

const POST_CONTENT_MAX = 200_000;

function postContentPlainLen(html: string): number {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** 글 작성·수정(제목·본문만; 이미지는 별도 state). 본문은 리치 HTML 문자열 */
export const postEditorSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(200, "제목은 200자 이하여야 합니다."),
  content: z
    .string()
    .max(POST_CONTENT_MAX, "본문이 너무 깁니다.")
    .refine((s) => postContentPlainLen(s) > 0, "본문을 입력해 주세요."),
});

export type PostEditorFormValues = z.infer<typeof postEditorSchema>;
