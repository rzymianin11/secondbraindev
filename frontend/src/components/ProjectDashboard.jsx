import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, getDecisionsByProject } from '../api';

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);
      const [projectData, decisionsData] = await Promise.all([
        getProject(projectId),
        getDecisionsByProject(projectId)
      ]);
      setProject(projectData);
      setDecisions(decisionsData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
        <Link to={`/project/${projectId}/decision/new`} className="btn btn-primary">
          Add Decision
        </Link>
      </div>

      <section className="timeline-section">
        <h2>Decision Timeline</h2>
        
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
    </div>
  );
}
