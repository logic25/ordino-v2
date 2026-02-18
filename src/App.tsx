import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute, SetupRoute, PublicRoute } from "@/components/routing/RouteGuards";
import { WalkthroughProvider } from "@/components/walkthrough/WalkthroughProvider";

// Pages
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Time from "./pages/Time";
import Proposals from "./pages/Proposals";
import Invoices from "./pages/Invoices";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import RfiForm from "./pages/RfiForm";
import ClientDetail from "./pages/ClientDetail";
import Emails from "./pages/Emails";
import Calendar from "./pages/Calendar";
import Documents from "./pages/Documents";
import Rfps from "./pages/Rfps";
import RfpLibrary from "./pages/RfpLibrary";
import RfpDiscovery from "./pages/RfpDiscovery";
import ClientProposal from "./pages/ClientProposal";
import Reports from "./pages/Reports";
import HelpDesk from "./pages/HelpDesk";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
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
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <ProjectDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties"
        element={
          <ProtectedRoute>
            <Properties />
          </ProtectedRoute>
        }
      />
      <Route
        path="/properties/:id"
        element={
          <ProtectedRoute>
            <PropertyDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/time"
        element={
          <ProtectedRoute>
            <Time />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals"
        element={
          <ProtectedRoute>
            <Proposals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <Invoices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <Clients />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/:id"
        element={
          <ProtectedRoute>
            <ClientDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/emails"
        element={
          <ProtectedRoute>
            <Emails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <Calendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <Documents />
          </ProtectedRoute>
        }
      />

      {/* RFP routes */}
      <Route
        path="/rfps"
        element={
          <ProtectedRoute>
            <Rfps />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rfps/library"
        element={
          <ProtectedRoute>
            <RfpLibrary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rfps/discover"
        element={
          <ProtectedRoute>
            <RfpDiscovery />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <HelpDesk />
          </ProtectedRoute>
        }
      />

      {/* Public RFI form - no auth required */}
      <Route path="/rfi" element={<RfiForm />} />

      {/* Public proposal page - client views & signs */}
      <Route path="/proposal/:token" element={<ClientProposal />} />

      {/* Legacy redirects */}
      <Route path="/team" element={<Navigate to="/settings" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
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
);

export default App;
