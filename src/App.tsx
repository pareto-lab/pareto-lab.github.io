import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import PropertyDetail from "./pages/PropertyDetail";
import PropertyPrint from "./pages/PropertyPrint";
import PropertyUploadImages from "./pages/PropertyUploadImages";
import DeliveryPage from "./pages/DeliveryPage";
import NotFound from "./pages/NotFound";
import HousingMBTI from "./pages/HousingMBTI";
import FloorplanTool from "./pages/FloorplanTool";
import AboutUs from "./pages/AboutUs";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminPropertyEdit from "./pages/admin/AdminPropertyEdit";
import AdminInquiries from "./pages/admin/AdminInquiries";
import AdminMbtiResults from "./pages/admin/AdminMbtiResults";
import AdminOpenHouseCalendar from "./pages/admin/AdminOpenHouseCalendar";
import AdminPropertyPreview from "./pages/admin/AdminPropertyPreview";
import AdminPropertyJsonEdit from "./pages/admin/AdminPropertyJsonEdit";
import AdminMyProfile from "./pages/admin/AdminMyProfile";
import AdminBlogPosts from "./pages/admin/AdminBlogPosts";
import AdminBlogPostEdit from "./pages/admin/AdminBlogPostEdit";
import AdminBlogTags from "./pages/admin/AdminBlogTags";
import AdminBlogMenu from "./pages/admin/AdminBlogMenu";
import BlogIndex from "./pages/blog/BlogIndex";
import BlogTagPage from "./pages/blog/BlogTagPage";
import BlogPostPage from "./pages/blog/BlogPostPage";
import GuideDelivery from "./pages/GuideDelivery";
import ResetPassword from "./pages/ResetPassword";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import EmailVerify from "./pages/EmailVerify";
import MyAccount from "./pages/MyAccount";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import OAuthConsent from "./pages/OAuthConsent";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/properties/:property_id/delivery" element={<DeliveryPage />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route path="/properties/:id/print" element={<PropertyPrint />} />
            <Route path="/properties/:id/upload" element={<PropertyUploadImages />} />
            <Route path="/housing-mbti" element={<HousingMBTI />} />
            <Route path="/admin/floorplan-tool" element={<FloorplanTool />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/guide/delivery" element={<GuideDelivery />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/email-verify" element={<EmailVerify />} />
            <Route path="/me" element={<MyAccount />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/oauth-consent" element={<OAuthConsent />} />
            {/* Blog public pages */}
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/tag/:tagSlug" element={<BlogTagPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="properties" replace />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:id" element={<AdminUserDetail />} />
              <Route path="properties" element={<AdminProperties />} />
              <Route path="properties/:id" element={<AdminPropertyEdit />} />
              <Route path="properties/:id/preview" element={<AdminPropertyPreview />} />
              <Route path="properties/:id/json" element={<AdminPropertyJsonEdit />} />
              <Route path="open-house-calendar" element={<AdminOpenHouseCalendar />} />
              <Route path="inquiries" element={<AdminInquiries />} />
              <Route path="mbti-results" element={<AdminMbtiResults />} />
              <Route path="me" element={<AdminMyProfile />} />
              {/* Blog admin */}
              <Route path="blog/posts" element={<AdminBlogPosts />} />
              <Route path="blog/posts/new" element={<AdminBlogPostEdit />} />
              <Route path="blog/posts/:postId/edit" element={<AdminBlogPostEdit />} />
              <Route path="blog/tags" element={<AdminBlogTags />} />
              <Route path="blog/menu" element={<AdminBlogMenu />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
