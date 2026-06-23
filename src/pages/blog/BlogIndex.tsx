import { useState } from "react";
import { Loader2 } from "lucide-react";
import { BlogSidebar } from "@/components/blog/BlogSidebar";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { Pager } from "@/components/blog/Pager";
import { useBlogPosts } from "@/hooks/useBlog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const PAGE_SIZE = 12;

export default function BlogIndex() {
  useDocumentTitle("블로그 | 하우스인어스");
  const [page, setPage] = useState(0);
  const { data, isLoading } = useBlogPosts({ skip: page * PAGE_SIZE, limit: PAGE_SIZE });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-6xl">
        <div className="flex gap-8">
          <BlogSidebar />

          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-2xl font-semibold mb-6">홈</h1>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                아직 게시된 글이 없습니다.
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
