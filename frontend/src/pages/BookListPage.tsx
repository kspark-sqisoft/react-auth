import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth-store";
import { BOOK_PAGE_DEFAULT, createBook, fetchBooksPage } from "@/lib/api";
import {
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
} from "@/lib/book-canvas";
import { useBookPageThumbnails } from "@/lib/use-book-page-thumbnails";
import { bookKeys } from "@/lib/query-keys";
import { BookListItem } from "@/components/books/BookListItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";

export function BookListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const createDefaultBook = useMutation({
    mutationFn: () =>
      createBook({
        title: "제목 없음",
        slideWidth: DEFAULT_SLIDE_WIDTH,
        slideHeight: DEFAULT_SLIDE_HEIGHT,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      void queryClient.setQueryData(bookKeys.detail(res.id), res);
      void navigate(`/books/${res.id}`, { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applySearch = () => {
    const q = searchInput.trim();
    setSearchQuery(q);
    if (q) setSearchParams({ search: q });
    else setSearchParams({});
  };

  const items = data?.items ?? [];

  const listThumbPages = useMemo(
    () =>
      items
        .filter((b) => b.coverPreview)
        .map((b) => {
          const c = b.coverPreview!;
          return {
            clientKey: `book-list-${b.id}`,
            backgroundColor: c.backgroundColor,
            elements: c.elements,
            slideWidth: c.slideWidth,
            slideHeight: c.slideHeight,
          };
        }),
    [items],
  );

  const listCoverThumbnails = useBookPageThumbnails(
    listThumbPages,
    DEFAULT_SLIDE_WIDTH,
    DEFAULT_SLIDE_HEIGHT,
  );

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
          <Button
            type="button"
            disabled={createDefaultBook.isPending}
            onClick={() => createDefaultBook.mutate()}
          >
            {createDefaultBook.isPending ? (
              <Spinner className="mr-1.5 size-4" aria-hidden />
            ) : (
              <Plus className="mr-1.5 size-4" aria-hidden />
            )}
            새 북
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
      ) : !items.length ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          아직 북이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((b) => (
            <BookListItem
              key={b.id}
              book={b}
              coverThumbDataUrl={listCoverThumbnails[`book-list-${b.id}`]}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
