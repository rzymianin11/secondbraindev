import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProject, createDecision } from '../api';

const LINK_TYPES = ['commit', 'pr', 'task', 'file', 'note'];

export default function NewDecision() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reason: '',
    consequences: ''
  });
  
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState({ type: 'commit', reference: '' });

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  }

  function handleAddLink() {
    if (!newLink.reference.trim()) return;
    setLinks([...links, { ...newLink, id: Date.now() }]);
    setNewLink({ type: 'commit', reference: '' });
  }

  function handleRemoveLink(id) {
    setLinks(links.filter(link => link.id !== id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      setSubmitting(true);
      await createDecision({
        projectId: Number(projectId),
        ...formData,
        links: links.map(({ type, reference }) => ({ type, reference }))
      });
      navigate(`/project/${projectId}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
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
    <div className="new-decision">
      <div className="breadcrumb">
        <Link to="/">Projects</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to={`/project/${projectId}`}>{project.name}</Link>
        <span className="breadcrumb-separator">/</span>
        <span>New Decision</span>
      </div>

      <h1>Record a Decision</h1>

      {error && <div className="error-message">{error}</div>}

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Decision Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g., Switch from REST to GraphQL"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="What was decided? Describe the change or choice made..."
            rows={4}
          />
        </div>

        <div className="form-group">
          <label htmlFor="reason">Reason (Why?)</label>
          <textarea
            id="reason"
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            placeholder="Why was this decision made? What problem does it solve?"
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="consequences">Consequences & Trade-offs</label>
          <textarea
            id="consequences"
            name="consequences"
            value={formData.consequences}
            onChange={handleInputChange}
            placeholder="What are the known trade-offs? What might need attention later?"
            rows={3}
          />
        </div>

        <div className="form-section">
          <h3>References</h3>
          <p className="form-hint">Link related commits, PRs, tasks, or notes</p>
          
          <div className="link-input-row">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLink();
                }
              }}
            />
            <button type="button" className="btn" onClick={handleAddLink}>
              Add
            </button>
          </div>

          {links.length > 0 && (
            <ul className="link-list">
              {links.map(link => (
                <li key={link.id} className="link-item">
                  <span className="link-type">{link.type}</span>
                  <span className="link-reference">{link.reference}</span>
                  <button 
                    type="button" 
                    className="btn-icon" 
                    onClick={() => handleRemoveLink(link.id)}
                    aria-label="Remove link"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="form-actions">
          <Link to={`/project/${projectId}`} className="btn">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Decision'}
          </button>
        </div>
      </form>
    </div>
  );
}
