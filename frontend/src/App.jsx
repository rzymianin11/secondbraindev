import { Routes, Route } from 'react-router-dom';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';
import DecisionView from './components/DecisionView';
import NewDecision from './components/NewDecision';
import RecordingView from './components/RecordingView';
import GraphView from './components/GraphView';
import QuickNotes from './components/QuickNotes';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <a href="/" className="app-logo">
          <img src="/logobrain.svg" alt="Second Brain for Devs" className="logo-img" />
        </a>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:projectId" element={<ProjectDashboard />} />
          <Route path="/project/:projectId/decision/new" element={<NewDecision />} />
          <Route path="/project/:projectId/graph" element={<GraphView />} />
          <Route path="/decision/:decisionId" element={<DecisionView />} />
          <Route path="/recording/:recordingId" element={<RecordingView />} />
        </Routes>
      </main>
      <QuickNotes />
    </div>
  );
}