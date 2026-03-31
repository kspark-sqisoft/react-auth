import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { MyInfoPage } from "@/pages/MyInfoPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { BookDetailPage } from "@/pages/BookDetailPage";
import { BookEditorPage } from "@/pages/BookEditorPage";
import { BookPresentationPage } from "@/pages/BookPresentationPage";
import { BookListPage } from "@/pages/BookListPage";
import { PostDetailPage } from "@/pages/PostDetailPage";
import { PostEditorPage } from "@/pages/PostEditorPage";
import { PostListPage } from "@/pages/PostListPage";
import { SignupPage } from "@/pages/SignupPage";
import { CatsPage } from "@/pages/CatsPage";
import { CatDetailPage } from "@/pages/CatDetailPage";

function BookLegacyEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/books/${id}`} replace />;
}

/**
 * 라우트 구성 요약
 * - 공개: 홈, 로그인/가입, 글·Cats 목록·상세
 * - 보호(`ProtectedRoute`): 글 작성/수정, 내 정보 — 비로그인 시 로그인으로 보냄
 */
const App = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/posts" element={<PostListPage />} />
        <Route path="/books" element={<BookListPage />} />
        <Route path="/cats" element={<CatsPage />} />
        <Route path="/cats/:id" element={<CatDetailPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/posts/new" element={<PostEditorPage />} />
          <Route path="/posts/:id/edit" element={<PostEditorPage />} />
          <Route path="/books/new" element={<BookEditorPage />} />
          <Route path="/me" element={<MyInfoPage />} />
        </Route>
        {/* 상세는 공개; `/posts/new`보다 뒤에 두어 `new`가 id로 해석되지 않게 함 */}
        <Route path="/posts/:id" element={<PostDetailPage />} />
        <Route path="/books/:id/edit" element={<BookLegacyEditRedirect />} />
        <Route path="/books/:id/preview" element={<BookPresentationPage />} />
        <Route path="/books/:id" element={<BookDetailPage />} />
      </Route>
    </Routes>
  );
};

export default App;
