import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { BlogSidebar } from "@/components/blog/BlogSidebar";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { Pager } from "@/components/blog/Pager";
import { useBlogPosts, useBlogTags } from "@/hooks/useBlog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const PAGE_SIZE = 12;

export default function BlogTagPage() {
  const { tagSlug } = useParams<{ tagSlug: string }>();
  const [page, setPage] = useState(0);
  const { data, isLoading } = useBlogPosts({ tag: tagSlug, skip: page * PAGE_SIZE, limit: PAGE_SIZE });
  const { data: tags } = useBlogTags();
  const tag = tags?.find((t) => t.slug === tagSlug);
  useDocumentTitle(tag ? `${tag.name} | 블로그 | 하우스인어스` : "블로그 | 하우스인어스");

  // Reset page when tag changes
  useEffect(() => setPage(0), [tagSlug]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-6xl">
        <div className="flex gap-8">
          <BlogSidebar />

          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <Link
                to="/blog"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                전체 글
              </Link>
              <h1 className="font-serif text-2xl font-semibold">
                {tag?.name ?? tagSlug}
              </h1>
              {data && (
                <p className="text-sm text-muted-foreground mt-1">
                  아티클 {data.total}
                </p>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                이 카테고리에 게시된 글이 없습니다.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.items.map((post) => (
                    <BlogPostCard key={post.id} post={post} />
                  ))}
                </div>

                <Pager page={page} totalPages={totalPages} onChange={setPage} />
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
