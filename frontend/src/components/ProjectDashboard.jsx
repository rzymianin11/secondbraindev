import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, getDecisionsByProject, getRecordingsByProject, getTasksByProject } from '../api';
import RecordingButton from './RecordingButton';
import RecordingsList from './RecordingsList';
import TasksList from './TasksList';

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('decisions');

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);
      const [projectData, decisionsData, recordingsData, tasksData] = await Promise.all([
        getProject(projectId),
        getDecisionsByProject(projectId),
        getRecordingsByProject(projectId),
        getTasksByProject(projectId)
      ]);
      setProject(projectData);
      setDecisions(decisionsData);
      setRecordings(recordingsData);
      setTasks(tasksData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRecordingComplete(recording) {
    loadData(); // Reload all data
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  if (error) {
    return (
      <div className="error-state">
        <p className="error-message">{error}</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="error-state">
        <p>Project not found.</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="project-dashboard">
      <div className="breadcrumb">
        <Link to="/">Projects</Link>
        <span className="breadcrumb-separator">/</span>
        <span>{project.name}</span>
      </div>

      <div className="project-header">
        <div>
          <h1>{project.name}</h1>
          {project.description && (
            <p className="project-description">{project.description}</p>
          )}
        </div>
        <div className="project-actions">
          <RecordingButton 
            projectId={Number(projectId)} 
            onRecordingComplete={handleRecordingComplete}
          />
          <Link to={`/project/${projectId}/decision/new`} className="btn btn-primary">
            Add Decision
          </Link>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button 
          className={`tab ${activeTab === 'decisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('decisions')}
        >
          Decisions ({decisions.length})
        </button>
        <button 
          className={`tab ${activeTab === 'recordings' ? 'active' : ''}`}
          onClick={() => setActiveTab('recordings')}
        >
          Recordings ({recordings.length})
        </button>
        <button 
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks ({tasks.filter(t => t.status !== 'done').length})
        </button>
      </div>

      {activeTab === 'decisions' && (
        <section className="timeline-section">
          {decisions.length === 0 ? (
            <div className="empty-state">
              <p>No decisions recorded yet.</p>
              <p>Document your first technical decision to build your project's memory.</p>
            </div>
          ) : (
            <div className="timeline">
              {decisions.map((decision, index) => (
                <div key={decision.id} className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <Link to={`/decision/${decision.id}`} className="timeline-card">
                      <div className="timeline-date">
                        <span>{formatDate(decision.createdAt)}</span>
                        <span className="timeline-time">{formatTime(decision.createdAt)}</span>
                      </div>
                      <h3 className="timeline-title">{decision.title}</h3>
                      {decision.description && (
                        <p className="timeline-description">
                          {decision.description.length > 150 
                            ? decision.description.slice(0, 150) + '...' 
                            : decision.description}
                        </p>
                      )}
                      {decision.reason && (
                        <div className="timeline-reason">
                          <strong>Why:</strong> {decision.reason.length > 100 
                            ? decision.reason.slice(0, 100) + '...' 
                            : decision.reason}
                        </div>
                      )}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'recordings' && (
        <section className="recordings-section">
          <RecordingsList recordings={recordings} projectId={projectId} />
        </section>
      )}

      {activeTab === 'tasks' && (
        <section className="tasks-section">
          <TasksList 
            tasks={tasks} 
            projectId={Number(projectId)}
            onTaskUpdate={loadData}
          />
        </section>
      )}
    </div>
  );
}
