import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import FilePreviewPage from "./pages/FilePreviewPage";
import FileManagerPage from "./pages/FileManagerPage";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import UploadPage from "./pages/UploadPage";

export default function App() {
  return (
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
  );
}
