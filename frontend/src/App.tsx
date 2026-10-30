import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { ProtectedRoute, PublicOnlyRoute } from "./components/Guards";
import Dashboard from "./pages/Dashboard";
import DeviceDetail from "./pages/DeviceDetail";
import Devices from "./pages/Devices";
import Diagnosis from "./pages/Diagnosis";
import FaultDetail from "./pages/FaultDetail";
import Faults from "./pages/Faults";
import KnowledgeBase from "./pages/KnowledgeBase";
import Alerts from "./pages/Alerts";
import Assistant from "./pages/Assistant";
import Monitoring from "./pages/Monitoring";
import Reports from "./pages/Reports";
import { Profile, Settings } from "./pages/Account";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { EmptyState } from "./components/ui";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ForgotPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="devices" element={<Devices />} />
          <Route path="devices/:id" element={<DeviceDetail />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="diagnosis" element={<Diagnosis />} />
          <Route path="faults" element={<Faults />} />
          <Route path="faults/:id" element={<FaultDetail />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="rules" element={<KnowledgeBase rulesView />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<EmptyState title="Page not found" />} />
        </Route>
      </Route>
    </Routes>
  );
}
