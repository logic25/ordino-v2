import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute, SetupRoute, PublicRoute } from "@/components/routing/RouteGuards";

// Pages
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Properties from "./pages/Properties";
import Time from "./pages/Time";
import Proposals from "./pages/Proposals";
import Invoices from "./pages/Invoices";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import RfiForm from "./pages/RfiForm";
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
        path="/properties"
        element={
          <ProtectedRoute>
            <Properties />
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
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      {/* Public RFI form - no auth required */}
      <Route path="/rfi" element={<RfiForm />} />

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
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
