import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/dashboard/Dashboard';
import { DocumentIntake } from './pages/documents/DocumentIntake';
import { EvidenceReview } from './pages/evidence/EvidenceReview';
import { EventTimeline } from './pages/timeline/EventTimeline';
import { WorkingCapTable } from './pages/captable/WorkingCapTable';
import { TopologyGraph } from './pages/topology/TopologyGraph';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'documents':
        return <DocumentIntake />;
      case 'evidence':
        return <EvidenceReview />;
      case 'timeline':
        return <EventTimeline />;
      case 'captable':
        return <WorkingCapTable />;
      case 'topology':
        return <TopologyGraph />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </AppLayout>
  );
}

export default App;
