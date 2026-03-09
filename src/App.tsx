import * as Sentry from "@sentry/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute, SetupRoute, PublicRoute } from "@/components/routing/RouteGuards";
import { WalkthroughProvider } from "@/components/walkthrough/WalkthroughProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Pages
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Eager-loaded pages (auth / shell)
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Properties = lazy(() => import("./pages/Properties"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const Time = lazy(() => import("./pages/Time"));
const Proposals = lazy(() => import("./pages/Proposals"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Clients = lazy(() => import("./pages/Clients"));
const Settings = lazy(() => import("./pages/Settings"));
const RfiForm = lazy(() => import("./pages/RfiForm"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Emails = lazy(() => import("./pages/Emails"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Documents = lazy(() => import("./pages/Documents"));
const Rfps = lazy(() => import("./pages/Rfps"));
const RfpLibrary = lazy(() => import("./pages/RfpLibrary"));
const RfpDiscovery = lazy(() => import("./pages/RfpDiscovery"));
const ClientProposal = lazy(() => import("./pages/ClientProposal"));
const ClientChangeOrder = lazy(() => import("./pages/ClientChangeOrder"));
const Reports = lazy(() => import("./pages/Reports"));
const HelpDesk = lazy(() => import("./pages/HelpDesk"));
const Chat = lazy(() => import("./pages/Chat"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Setup route - requires auth but no profile */}
      <Route
        path="/setup"
        element={
          <SetupRoute>
            <Setup />
          </SetupRoute>
        }
      />

      {/* Protected routes - requires auth AND profile */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
      <Route path="/properties" element={<ProtectedRoute><Properties /></ProtectedRoute>} />
      <Route path="/properties/:id" element={<ProtectedRoute><PropertyDetail /></ProtectedRoute>} />
      <Route path="/time" element={<ProtectedRoute><Time /></ProtectedRoute>} />
      <Route path="/proposals" element={<ProtectedRoute><Proposals /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/emails" element={<ProtectedRoute><Emails /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/rfps" element={<ProtectedRoute><Rfps /></ProtectedRoute>} />
      <Route path="/rfps/library" element={<ProtectedRoute><RfpLibrary /></ProtectedRoute>} />
      <Route path="/rfps/discover" element={<ProtectedRoute><RfpDiscovery /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><HelpDesk /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

      {/* Public RFI form - no auth required */}
      <Route path="/rfi" element={<RfiForm />} />

      {/* Public proposal page - client views & signs */}
      <Route path="/proposal/:token" element={<ClientProposal />} />

      {/* Public change order page - client views & signs */}
      <Route path="/change-order/:token" element={<ClientChangeOrder />} />

      {/* Legal pages - public, no auth required */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* Legacy redirects */}
      <Route path="/team" element={<Navigate to="/settings" replace />} />


      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function SentryFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>We've been notified and are looking into it.</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

const App = () => (
  <Sentry.ErrorBoundary fallback={<SentryFallback />}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WalkthroughProvider>
              <AppRoutes />
            </WalkthroughProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
