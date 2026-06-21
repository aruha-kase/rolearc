import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// ルートごとに分割読み込み（初回JSを軽く・OBS等は必要な分だけ取得）
const RoomListPage = lazy(() => import("./pages/RoomListPage"));
const BoardPage = lazy(() => import("./pages/BoardPage"));
const ObsPage = lazy(() => import("./pages/ObsPage"));
const ViewerPage = lazy(() => import("./pages/ViewerPage"));
const ScenarioPage = lazy(() => import("./pages/ScenarioPage"));
const LsmPage = lazy(() => import("./pages/LsmPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-background">
    <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<RoomListPage />} />
            <Route path="/room/:roomId" element={<BoardPage />} />
            <Route path="/room/:roomId/scenario" element={<ScenarioPage />} />
            <Route path="/lsm" element={<LsmPage />} />
            <Route path="/obs/:roomId" element={<ObsPage />} />
            <Route path="/view/:token" element={<ViewerPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
