import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { deleteCat, fetchCat } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { catKeys } from "@/lib/query-keys";
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
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { CenteredSpinner } from "@/components/layout/CenteredSpinner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateFullShort } from "@/lib/format-date";
import { toast } from "sonner";

/** 공개 상세. 로그인 시 삭제 가능 (백엔드 JwtAuthGuard). */
export function CatDetailPage() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : NaN;
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: cat,
    isPending,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: catKeys.detail(id),
    queryFn: async () => {
      const c = await fetchCat(id);
      appLog("cats", "상세 로드", { id: c.id });
      return c;
    },
    enabled: Number.isFinite(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCat(id),
    onSuccess: () => {
      toast.success("삭제되었습니다.");
      void queryClient.invalidateQueries({ queryKey: catKeys.all });
      setDeleteOpen(false);
      navigate("/cats", { replace: true });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    },
  });

  useEffect(() => {
    if (!Number.isFinite(id) || !isError) return;
    const msg =
      queryError instanceof Error
        ? queryError.message
        : "불러오지 못했습니다.";
    toast.error(msg);
  }, [id, isError, queryError]);

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message="잘못된 번호입니다." />
        <Button asChild variant="outline" size="sm">
          <Link to="/cats">목록으로</Link>
        </Button>
      </div>
    );
  }

  if (isPending) {
    return <CenteredSpinner />;
  }

  const loadError =
    isError && queryError instanceof Error
      ? queryError.message
      : isError
        ? "불러오지 못했습니다."
        : null;

  if (loadError || !cat) {
    return (
      <div className="space-y-4">
        <FormErrorAlert message={loadError ?? "데이터가 없습니다."} />
        <Button asChild variant="outline" size="sm">
          <Link to="/cats">목록으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/cats">← 목록</Link>
        </Button>
        {user ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            삭제
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{cat.name}</CardTitle>
          <CardDescription>
            ID {cat.id} · 나이 {cat.age} · 품종 {cat.breed}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>등록: {formatDateFullShort(cat.createdAt)}</p>
          <p>수정: {formatDateFullShort(cat.updatedAt)}</p>
        </CardContent>
      </Card>

      {!user ? (
        <p className="text-sm text-muted-foreground">
          삭제하려면{" "}
          <Button asChild variant="link" className="h-auto p-0">
            <Link to="/login" state={{ from: { pathname: `/cats/${id}` } }}>
              로그인
            </Link>
          </Button>
          하세요.
        </p>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{cat.name}」을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
