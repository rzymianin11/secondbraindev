import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDecision, getProject, deleteDecision, addLink, deleteLink } from '../api';

const LINK_TYPES = ['commit', 'pr', 'task', 'file', 'note'];

export default function DecisionView() {
  const { decisionId } = useParams();
  const navigate = useNavigate();
  const [decision, setDecision] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [newLink, setNewLink] = useState({ type: 'commit', reference: '' });
  const [addingLink, setAddingLink] = useState(false);

  useEffect(() => {
    loadDecision();
  }, [decisionId]);

  async function loadDecision() {
    try {
      setLoading(true);
      const decisionData = await getDecision(decisionId);
      setDecision(decisionData);
      
      const projectData = await getProject(decisionData.projectId);
      setProject(projectData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this decision?')) return;
    
    try {
      await deleteDecision(decisionId);
      navigate(`/project/${decision.projectId}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddLink(e) {
    e.preventDefault();
    if (!newLink.reference.trim()) return;

    try {
      setAddingLink(true);
      const link = await addLink(decisionId, newLink);
      setDecision({
        ...decision,
        links: [...decision.links, link]
      });
      setNewLink({ type: 'commit', reference: '' });
      setShowLinkForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingLink(false);
    }
  }

  async function handleDeleteLink(linkId) {
    try {
      await deleteLink(linkId);
      setDecision({
        ...decision,
        links: decision.links.filter(l => l.id !== linkId)
      });
    } catch (err) {
      setError(err.message);
    }
  }

  function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getLinkIcon(type) {
    const icons = {
      commit: '⟠',
      pr: '↗',
      task: '☐',
      file: '◇',
      note: '◈'
    };
    return icons[type] || '•';
  }

  if (loading) {
    return <div className="loading">Loading decision...</div>;
  }

  if (error && !decision) {
    return (
      <div className="error-state">
        <p className="error-message">{error}</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="error-state">
        <p>Decision not found.</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  function handleBackgroundClick(e) {
    // Only navigate back if clicking directly on the background
    if (e.target === e.currentTarget) {
      navigate(`/project/${decision.projectId}`);
    }
  }

  return (
    <div className="decision-view" onClick={handleBackgroundClick}>
      <div className="breadcrumb">
        <Link to="/">Projects</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to={`/project/${decision.projectId}`}>{project?.name || 'Project'}</Link>
        <span className="breadcrumb-separator">/</span>
        <span>Decision</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <article className="decision-article" onClick={(e) => e.stopPropagation()}>
        <header className="decision-header">
          <h1>{decision.title}</h1>
          <time className="decision-time">{formatDateTime(decision.createdAt)}</time>
        </header>

        {decision.description && (
          <section className="decision-section">
            <h2>Description</h2>
            <p className="decision-text">{decision.description}</p>
          </section>
        )}

        {decision.reason && (
          <section className="decision-section">
            <h2>Reason</h2>
            <p className="decision-text">{decision.reason}</p>
          </section>
        )}

        {decision.consequences && (
          <section className="decision-section">
            <h2>Consequences & Trade-offs</h2>
            <p className="decision-text">{decision.consequences}</p>
          </section>
        )}

        <section className="decision-section">
          <div className="section-header">
            <h2>References</h2>
            <button 
              className="btn btn-small" 
              onClick={() => setShowLinkForm(!showLinkForm)}
            >
              {showLinkForm ? 'Cancel' : 'Add Link'}
            </button>
          </div>

          {showLinkForm && (
            <form className="link-form" onSubmit={handleAddLink}>
              <select
                value={newLink.type}
                onChange={(e) => setNewLink({ ...newLink, type: e.target.value })}
              >
                {LINK_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                type="text"
                value={newLink.reference}
                onChange={(e) => setNewLink({ ...newLink, reference: e.target.value })}
                placeholder="URL, commit hash, or reference"
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={addingLink}>
                {addingLink ? 'Adding...' : 'Add'}
              </button>
            </form>
          )}

          {decision.links && decision.links.length > 0 ? (
            <ul className="reference-list">
              {decision.links.map(link => (
                <li key={link.id} className="reference-item">
                  <span className="reference-icon">{getLinkIcon(link.type)}</span>
                  <span className="reference-type">{link.type}</span>
                  {link.reference.startsWith('http') ? (
                    <a 
                      href={link.reference} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="reference-link"
                    >
                      {link.reference}
                    </a>
                  ) : (
                    <span className="reference-text">{link.reference}</span>
                  )}
                  <button 
                    className="btn-icon"
                    onClick={() => handleDeleteLink(link.id)}
                    aria-label="Remove link"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-hint">No references linked yet.</p>
          )}
        </section>

        <footer className="decision-footer">
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete Decision
          </button>
        </footer>
      </article>
    </div>
  );
}
