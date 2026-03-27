import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { BookMarked, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/stores/auth-store";
import { BOOK_PAGE_DEFAULT, fetchBooksPage } from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";

export function BookListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [searchQuery, setSearchQuery] = useState(urlSearch.trim());

  const listKey = useMemo(() => bookKeys.list(searchQuery), [searchQuery]);

  const { data, error, isPending } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      fetchBooksPage({
        skip: 0,
        take: BOOK_PAGE_DEFAULT,
        search: searchQuery || undefined,
      }),
  });

  const applySearch = () => {
    const q = searchInput.trim();
    setSearchQuery(q);
    if (q) setSearchParams({ search: q });
    else setSearchParams({});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">북</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            슬라이드처럼 페이지를 두고 Konva로 텍스트·이미지·동영상을 배치합니다.
          </p>
        </div>
        {user ? (
          <Button asChild>
            <Link to="/books/new">
              <Plus className="mr-1.5 size-4" aria-hidden />
              새 북
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9 pr-9"
            placeholder="제목 검색…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
            aria-label="북 제목 검색"
          />
          {searchInput ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setSearchParams({});
              }}
              aria-label="검색어 지우기"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Button type="button" variant="secondary" onClick={applySearch}>
          검색
        </Button>
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      ) : error ? (
        <FormErrorAlert message={(error as Error).message} />
      ) : !(data?.items?.length ?? 0) ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          아직 북이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {(data?.items ?? []).map((b) => (
            <li key={b.id}>
              <Link
                to={`/books/${b.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <BookMarked className="size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.author.name} · 페이지 {b.pageCount} ·{" "}
                    {new Date(b.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
