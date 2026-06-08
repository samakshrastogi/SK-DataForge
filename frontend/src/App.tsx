import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell";
import { useAuth } from "./context/AuthContext";
import FilePreviewPage from "./pages/FilePreviewPage";
import FileManagerPage from "./pages/FileManagerPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SearchPage from "./pages/SearchPage";
import UploadPage from "./pages/UploadPage";

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center text-sm font-semibold text-slate-600">
        Loading workspace...
      </main>
    );
  }

  if (!user && location.pathname !== "/login") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/manager" element={<FileManagerPage />} />
              <Route path="/manager/folders/:folderId" element={<FileManagerPage />} />
              <Route path="/files/:fileId" element={<FilePreviewPage />} />
              <Route path="/search" element={<SearchPage />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}
