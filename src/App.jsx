import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import AppShell from "./components/layout/AppShell.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import InvoiceBuilderPage from "./pages/InvoiceBuilderPage.jsx";
import InvoicesPage from "./pages/InvoicesPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import TemplatesPage from "./pages/TemplatesPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import LogsPage from "./pages/LogsPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

function Page({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="app-bg min-h-screen">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/verify-otp" element={<AuthPage mode="otp" />} />
          <Route path="/reset-password" element={<AuthPage mode="reset" />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />
              <Route element={<ProtectedRoute roles={["Super Admin"]} />}>
                <Route path="/admins" element={<Page><UsersPage type="Admin" /></Page>} />
                <Route path="/permissions" element={<Page><UsersPage type="Permissions" /></Page>} />
                <Route path="/logs" element={<Page><LogsPage /></Page>} />
              </Route>
              <Route element={<ProtectedRoute roles={["Super Admin", "Admin"]} />}>
                <Route path="/managers" element={<Page><UsersPage type="Manager" /></Page>} />
              </Route>
              <Route path="/invoices" element={<Page><InvoicesPage /></Page>} />
              <Route path="/invoices/new" element={<Page><InvoiceBuilderPage /></Page>} />
              <Route path="/invoices/:id/edit" element={<Page><InvoiceBuilderPage /></Page>} />
              <Route path="/clients" element={<Page><ClientsPage /></Page>} />
              <Route element={<ProtectedRoute roles={["Super Admin", "Admin"]} />}>
                <Route path="/templates" element={<Page><TemplatesPage /></Page>} />
              </Route>
              <Route path="/reports" element={<Page><ReportsPage /></Page>} />
              <Route path="/analytics" element={<Page><ReportsPage /></Page>} />
              <Route path="/payments" element={<Page><PaymentsPage /></Page>} />
              <Route element={<ProtectedRoute roles={["Super Admin", "Admin"]} />}>
                <Route path="/settings" element={<Page><SettingsPage /></Page>} />
              </Route>
              <Route path="/profile" element={<Page><ProfilePage /></Page>} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
