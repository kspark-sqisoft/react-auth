import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { MyInfoPage } from "@/pages/MyInfoPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { PostDetailPage } from "@/pages/PostDetailPage";
import { PostEditorPage } from "@/pages/PostEditorPage";
import { PostListPage } from "@/pages/PostListPage";
import { SignupPage } from "@/pages/SignupPage";

/**
 * 라우트 구성 요약
 * - 공개: 홈, 로그인/가입, 글 목록·상세
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
        <Route element={<ProtectedRoute />}>
          <Route path="/posts/new" element={<PostEditorPage />} />
          <Route path="/posts/:id/edit" element={<PostEditorPage />} />
          <Route path="/me" element={<MyInfoPage />} />
        </Route>
        {/* 상세는 공개; `/posts/new`보다 뒤에 두어 `new`가 id로 해석되지 않게 함 */}
        <Route path="/posts/:id" element={<PostDetailPage />} />
      </Route>
    </Routes>
  );
};

export default App;
