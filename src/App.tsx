import { Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import AgentLogin from "./pages/AgentLogin";
import AgentSignUp from "./pages/AgentSignUp";
import AnalyticsPage from './pages/AnalyticsPage';
import ImpactAnalytics from './pages/ImpactAnalytics';
import FacultyDetailPage from "./pages/FacultyDetailPage";
import FacultyListPage from "./pages/FacultyListPage";
import HeroSection from "./pages/HeroSection";
import HomePage from "./pages/HomePage";
import PaperDetailPage from "./pages/PaperDetailPage";
import ResearchDashboard from "./pages/ResearchDashboard";
import AdminPage from "./pages/AdminPage";
import AuthorPerformance from "./pages/AuthorPerformance";
import AuthorPerformanceDetail from "./pages/AuthorPerformanceDetails";
import MonthlyReport from "./pages/MonthlyReport";
import ReportsPage from "./pages/ReportsPage";
import AdvancedSearch from "./pages/AdvancedSearch";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicationStats from './pages/PublicationStats';
import PaperFacultyRatio from './pages/PaperFacultyRatio';
import QuartileReportPage from './pages/QuartileReportPage';
import PublicationTypesDashboard from "./pages/PublicationTypesDashboard";


const App: React.FC = () => {
  const { isAuthenticated, isRestrictedFaculty, user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<AgentLogin />} />
      <Route path="/signup" element={<AgentSignUp />} />
      <Route path="/hero" element={<HeroSection />} />

      {/* Protected routes - any authenticated user */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {/* Restricted faculty (level 3) are redirected to their faculty detail page */}
            {isAuthenticated && isRestrictedFaculty() && user?.facultyId ? (
              <Navigate to={`/faculty/${user.scopusId || user.facultyId}`} replace />
            ) : (
              <ResearchDashboard />
            )}
          </ProtectedRoute>
        }
      />

      {/* Publication Statistics - admin and full-access faculty only */}
      <Route
        path="/publication-stats"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <PublicationStats />
          </ProtectedRoute>
        }
      />

      {/* Publication Types Dashboard - admin and full-access faculty only */}
      <Route
        path="/publication-types"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <PublicationTypesDashboard />
          </ProtectedRoute>
        }
      />

      {/* Paper Faculty Ratio - admin and full-access faculty only */}
      <Route
        path="/paper-faculty-ratio"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <PaperFacultyRatio />
          </ProtectedRoute>
        }
      />

      {/* Faculty List - visible to all authenticated users except restricted faculty (level 3) */}
      <Route
        path="/faculty"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <FacultyListPage />
          </ProtectedRoute>
        }
      />

      {/* Faculty Detail - restricted faculty can only see their own */}
      <Route
        path="/faculty/:scopusId"
        element={
          <ProtectedRoute>
            <FacultyDetailPage />
          </ProtectedRoute>
        }
      />

      <Route path="/paper/:doi" element={<ProtectedRoute><PaperDetailPage /></ProtectedRoute>} />

      {/* Analytics - admin and full-access faculty only */}
      <Route
        path="/analytics"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />

      {/* Impact Analytics - admin and HoD (level 1 & 2) */}
      <Route
        path="/impact-analytics"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <ImpactAnalytics />
          </ProtectedRoute>
        }
      />

      {/* Admin Page - admin only (level 1) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredLevels={[1]}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      {/* Author Performance - admin and full-access faculty only */}
      <Route
        path="/author-performance"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <AuthorPerformance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/author-performance/:scopus_id"
        element={
          <ProtectedRoute>
            <AuthorPerformanceDetail />
          </ProtectedRoute>
        }
      />

      {/* Reports & Analytics - admin and full-access faculty only */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      {/* Monthly Report - admin and full-access faculty only */}
      <Route
        path="/monthly-report"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <MonthlyReport />
          </ProtectedRoute>
        }
      />

      {/* Quartile Report - admin and full-access faculty only */}
      <Route
        path="/quartile-report"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <QuartileReportPage />
          </ProtectedRoute>
        }
      />

      {/* Advanced Search - admin and full-access faculty only */}
      <Route
        path="/advanced-search"
        element={
          <ProtectedRoute requiredLevels={[1, 2]}>
            <AdvancedSearch />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
