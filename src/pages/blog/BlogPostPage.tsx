import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowLeft, Share2, Loader2, AlertCircle } from "lucide-react";
import { BlogSidebar } from "@/components/blog/BlogSidebar";
import { TiptapViewer } from "@/components/admin/blog/TiptapEditor";
import { useBlogPost } from "@/hooks/useBlog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, isError } = useBlogPost(slug ?? "");
  const { toast } = useToast();
  useDocumentTitle(post ? `${post.title} | 블로그 | 하우스인어스` : undefined);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "링크가 복사되었습니다." });
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast({ title: "링크가 복사되었습니다." });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-6xl">
        <div className="flex gap-8">
          <BlogSidebar />

          <div className="flex-1 min-w-0">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              블로그 홈
            </Link>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : isError || !post ? (
              <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
                <AlertCircle className="w-8 h-8" />
                <p>글을 찾을 수 없습니다.</p>
                <Link to="/blog" className="text-sm text-primary hover:underline">
                  블로그 홈으로
                </Link>
              </div>
            ) : (
              <article className="max-w-3xl">
                {/* Cover image */}
                {post.cover_image_url && (
                  <div className="aspect-video w-full rounded-xl overflow-hidden mb-8">
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map((tag) => (
                      <Link
                        key={tag.id}
                        to={`/blog/tag/${tag.slug}`}
                        className="text-xs font-medium text-primary bg-primary/8 hover:bg-primary/15 px-2.5 py-1 rounded-full transition-colors"
                      >
                        {tag.name}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Title */}
                <h1 className="font-serif text-4xl font-bold text-foreground leading-snug mb-3">
                  {post.title}
                </h1>

                {/* Date */}
                <p className="text-sm text-muted-foreground mb-8">
                  {format(new Date(post.reference_date), "yyyy년 MM월 dd일", { locale: ko })}
                </p>

                {/* Content */}
                <div className="mb-12">
                  {post.content && Object.keys(post.content).length > 0 ? (
                    <TiptapViewer content={post.content} />
                  ) : (
                    <p className="text-muted-foreground">본문이 없습니다.</p>
                  )}
                </div>

                {/* Share button */}
                <div className="border-t border-border pt-8 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className="flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    공유하기
                  </Button>
                </div>
              </article>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
