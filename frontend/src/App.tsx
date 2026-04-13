import { AppLayout } from "./components/layout/AppLayout";
import { useWorkbench, WorkbenchProvider } from "./context/WorkbenchContext";
import { Dashboard } from "./pages/dashboard/Dashboard";

function AppShell() {
  const { apiError } = useWorkbench();

  return (
    <AppLayout>
      <div className="h-full w-full">
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
