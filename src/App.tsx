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

function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  cacheKey: string,
) {
  return lazy(async () => {
    const retryKey = `lazy-retry:${cacheKey}`;

    try {
      const module = await importer();
      sessionStorage.removeItem(retryKey);
      return module;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isChunkLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
      const hasRetried = sessionStorage.getItem(retryKey) === "1";

      if (isChunkLoadError && !hasRetried) {
        sessionStorage.setItem(retryKey, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }

      sessionStorage.removeItem(retryKey);
      throw error;
    }
  });
}

// Eager-loaded pages (auth / shell)
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "dashboard");
const Projects = lazyWithRetry(() => import("./pages/Projects"), "projects");
const ProjectDetail = lazyWithRetry(() => import("./pages/ProjectDetail"), "project-detail");
const Properties = lazyWithRetry(() => import("./pages/Properties"), "properties");
const PropertyDetail = lazyWithRetry(() => import("./pages/PropertyDetail"), "property-detail");
const Time = lazyWithRetry(() => import("./pages/Time"), "time");
const Proposals = lazyWithRetry(() => import("./pages/Proposals"), "proposals");
const Invoices = lazyWithRetry(() => import("./pages/Invoices"), "invoices");
const Clients = lazyWithRetry(() => import("./pages/Clients"), "clients");
const Settings = lazyWithRetry(() => import("./pages/Settings"), "settings");
const RfiForm = lazyWithRetry(() => import("./pages/RfiForm"), "rfi-form");
const ClientDetail = lazyWithRetry(() => import("./pages/ClientDetail"), "client-detail");
const Emails = lazyWithRetry(() => import("./pages/Emails"), "emails");
const Calendar = lazyWithRetry(() => import("./pages/Calendar"), "calendar");
const Documents = lazyWithRetry(() => import("./pages/Documents"), "documents");
const Rfps = lazyWithRetry(() => import("./pages/Rfps"), "rfps");
const RfpLibrary = lazyWithRetry(() => import("./pages/RfpLibrary"), "rfp-library");
const RfpDiscovery = lazyWithRetry(() => import("./pages/RfpDiscovery"), "rfp-discovery");
const ClientProposal = lazyWithRetry(() => import("./pages/ClientProposal"), "client-proposal");
const ClientChangeOrder = lazyWithRetry(() => import("./pages/ClientChangeOrder"), "client-change-order");
const Reports = lazyWithRetry(() => import("./pages/Reports"), "reports");
const Content = lazyWithRetry(() => import("./pages/Content"), "content");
const HelpDesk = lazyWithRetry(() => import("./pages/HelpDesk"), "help-desk");
const Chat = lazyWithRetry(() => import("./pages/Chat"), "chat");
const Privacy = lazyWithRetry(() => import("./pages/Privacy"), "privacy");
const Terms = lazyWithRetry(() => import("./pages/Terms"), "terms");
const Welcome = lazyWithRetry(() => import("./pages/Welcome"), "welcome");
const BdLeads = lazyWithRetry(() => import("./pages/bd/BdLeads"), "bd-leads");
const BdLeadDetail = lazyWithRetry(() => import("./pages/bd/BdLeadDetail"), "bd-lead-detail");
const BdEvents = lazyWithRetry(() => import("./pages/bd/BdEvents"), "bd-events");
const BdSequences = lazyWithRetry(() => import("./pages/bd/BdSequences"), "bd-sequences");
const MarketsHub = lazyWithRetry(() => import("./pages/MarketsHub"), "markets-hub");
const BdFollowUps = lazyWithRetry(() => import("./pages/bd/BdFollowUps"), "bd-follow-ups");
const PlaybookEditor = lazyWithRetry(() => import("./pages/PlaybookEditor"), "playbook-editor");
const BdEventDetail = lazyWithRetry(() => import("./pages/bd/BdEventDetail"), "bd-event-detail");
const BdEventCard = lazyWithRetry(() => import("./pages/bd/BdEventCard"), "bd-event-card");

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      gcTime: 1000 * 60 * 10,    // 10 minutes garbage collection
    },
  },
});

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
      <Route path="/bd/leads" element={<ProtectedRoute><BdLeads /></ProtectedRoute>} />
      <Route path="/bd/leads/:id" element={<ProtectedRoute><BdLeadDetail /></ProtectedRoute>} />
      <Route path="/bd/events" element={<ProtectedRoute><BdEvents /></ProtectedRoute>} />
      <Route path="/bd/events/:id" element={<ProtectedRoute><BdEventDetail /></ProtectedRoute>} />
      <Route path="/bd/sequences" element={<ProtectedRoute><BdSequences /></ProtectedRoute>} />
      <Route path="/bd/market-signals" element={<ProtectedRoute><MarketsHub defaultTab="signals" /></ProtectedRoute>} />
      <Route path="/markets" element={<ProtectedRoute><MarketsHub defaultTab="markets" /></ProtectedRoute>} />
      <Route path="/bd/follow-ups" element={<ProtectedRoute><BdFollowUps /></ProtectedRoute>} />
      <Route path="/markets/:marketId/playbooks/:id" element={<ProtectedRoute><PlaybookEditor /></ProtectedRoute>} />
      <Route path="/bd/event-card" element={<ProtectedRoute><BdEventCard /></ProtectedRoute>} />
      <Route path="/bd/capture" element={<Navigate to="/bd/event-card?tab=scan" replace />} />
      <Route path="/bd/my-card" element={<Navigate to="/bd/event-card?tab=mycard" replace />} />
      <Route path="/bd/card" element={<Navigate to="/bd/event-card?tab=mycard" replace />} />
      <Route path="/bd/prep" element={<Navigate to="/bd/events" replace />} />
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
      <Route path="/content" element={<ProtectedRoute><Content /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><HelpDesk /></ProtectedRoute>} />
      <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
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
    </Suspense>
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
