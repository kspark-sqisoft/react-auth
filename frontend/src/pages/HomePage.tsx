import { Link } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** 랜딩; 로그인 여부에 따라 안내 링크만 바뀝니다. */
export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">react-auth</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nest 백엔드와 연동한 회원가입·로그인·로그아웃 예제입니다.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>시작하기</CardTitle>
          <CardDescription>
            {user
              ? "내 정보에서 로그인된 계정을 확인할 수 있습니다."
              : "계정을 만들거나 로그인하세요."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant={user ? "outline" : "default"}>
            <Link to="/posts">글 목록 보기</Link>
          </Button>
          {user ? (
            <Button asChild>
              <Link to="/me">내 정보 보기</Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link to="/signup">회원가입</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/login">로그인</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
