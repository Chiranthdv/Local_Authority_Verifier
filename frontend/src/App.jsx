import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Search from "./pages/Search";
import WorkerProfile from "./pages/WorkerProfile";
import WorkerOnboarding from "./pages/WorkerOnboarding";
import AdminDashboard from "./pages/AdminDashboard";
import CustomerRequests from "./pages/CustomerRequests";
import WorkerRequests from "./pages/WorkerRequests";
import Notifications from "./pages/Notifications";
import Chat from "./pages/Chat";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-transparent">
        <Navbar />
        <main className="pt-24">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/worker/:id" element={<WorkerProfile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/worker/onboarding"
              element={
                <ProtectedRoute roles={["worker"]}>
                  <WorkerOnboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/my"
              element={
                <ProtectedRoute roles={["customer"]}>
                  <CustomerRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/inbox"
              element={
                <ProtectedRoute roles={["worker"]}>
                  <WorkerRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute roles={["customer", "worker", "admin"]}>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chats"
              element={
                <ProtectedRoute roles={["customer", "worker"]}>
                  <Chat />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
