import { AppLayout } from "./components/layout/AppLayout";
import { WorkbenchProvider } from "./context/WorkbenchContext";
import { Dashboard } from "./pages/dashboard/Dashboard";

function AppShell() {
  return (
    <AppLayout>
      <div className="h-full w-full overflow-hidden">
        <Dashboard />
      </div>
    </AppLayout>
  );
}

export default function App() {
  return (
    <WorkbenchProvider>
      <AppShell />
    </WorkbenchProvider>
  );
}
