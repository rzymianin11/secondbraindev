import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, createProject } from '../api';

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('active'); // active, archived, all

  useEffect(() => {
    loadProjects();
  }, []);

  const isArchived = (project) => project.name.startsWith('[Archived');
  
  const filteredProjects = projects.filter(p => {
    if (filter === 'active') return !isArchived(p);
    if (filter === 'archived') return isArchived(p);
    return true;
  });

  const activeCount = projects.filter(p => !isArchived(p)).length;
  const archivedCount = projects.filter(p => isArchived(p)).length;

  async function loadProjects() {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      const newProject = await createProject(formData);
      setProjects([newProject, ...projects]);
      setFormData({ name: '', description: '' });
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  return (
    <div className="project-list">
      <div className="page-header">
        <h1>Projects</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="project-filters">
        <button 
          className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active <span className="filter-count">{activeCount}</span>
        </button>
        <button 
          className={`filter-btn ${filter === 'archived' ? 'active' : ''}`}
          onClick={() => setFilter('archived')}
        >
          📦 Archived <span className="filter-count">{archivedCount}</span>
        </button>
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All <span className="filter-count">{projects.length}</span>
        </button>
      </div>

      {showForm && (
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Project Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Awesome Project"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the project..."
              rows={3}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      {filteredProjects.length === 0 ? (
        <div className="empty-state">
          {filter === 'archived' ? (
            <p>No archived projects yet.</p>
          ) : filter === 'active' ? (
            <>
              <p>No active projects.</p>
              <p>Create a new project to start tracking decisions.</p>
            </>
          ) : (
            <>
              <p>No projects yet.</p>
              <p>Create your first project to start tracking decisions.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="list">
          {filteredProjects.map((project) => (
            <li key={project.id} className={`list-item ${isArchived(project) ? 'archived' : ''}`}>
              <Link to={`/project/${project.id}`} className="list-item-link">
                <div className="list-item-header">
                  <h3 className="list-item-title">
                    {isArchived(project) && <span className="archived-badge">📦</span>}
                    {project.name.replace(/^\[Archived \d{4}-\d{2}-\d{2}\] /, '')}
                  </h3>
                  <span className="list-item-date">
                    {isArchived(project) && (
                      <span className="archived-date">
                        {project.name.match(/\d{4}-\d{2}-\d{2}/)?.[0] || ''}
                      </span>
                    )}
                    {!isArchived(project) && formatDate(project.createdAt)}
                  </span>
                </div>
                {project.description && (
                  <p className="list-item-description">{project.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
