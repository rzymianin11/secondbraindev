import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, getDecisionsByProjectWithFilter, getRecordingsByProject, getTasksByProject } from '../api';
import RecordingButton from './RecordingButton';
import RecordingsList from './RecordingsList';
import TasksList from './TasksList';
import TagFilter from './TagFilter';
import TagBadge from './TagBadge';
import SearchBar from './SearchBar';
import EditProjectModal from './EditProjectModal';
import ImageAnalyzer from './ImageAnalyzer';

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('decisions');
  const [selectedTag, setSelectedTag] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId, selectedTag]);

  async function loadData() {
    try {
      setLoading(true);
      const [projectData, decisionsData, recordingsData, tasksData] = await Promise.all([
        getProject(projectId),
        getDecisionsByProjectWithFilter(projectId, selectedTag),
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
    loadData();
  }

  function handleTagSelect(tag) {
    setSelectedTag(tag);
  }

  function handleProjectSave(updatedProject) {
    setProject(updatedProject);
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
          <div className="project-title-row">
            <h1>{project.name}</h1>
            <button 
              className="btn-icon" 
              onClick={() => setShowEditModal(true)}
              title="Edit project"
            >
              ✎
            </button>
          </div>
          {project.description && (
            <p className="project-description">{project.description}</p>
          )}
        </div>
        <div className="project-actions">
          <SearchBar projectId={Number(projectId)} />
          <Link to={`/project/${projectId}/graph`} className="btn" title="View Decision Graph">
            Graph
          </Link>
          <RecordingButton 
            projectId={Number(projectId)} 
            onRecordingComplete={handleRecordingComplete}
          />
          <Link to={`/project/${projectId}/decision/new`} className="btn btn-primary">
            Add Decision
          </Link>
        </div>
      </div>

      <EditProjectModal
        project={project}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleProjectSave}
      />

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
        <button 
          className={`tab ${activeTab === 'ocr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ocr')}
        >
          OCR
        </button>
      </div>

      {activeTab === 'decisions' && (
        <section className="timeline-section">
          <TagFilter 
            projectId={Number(projectId)}
            selectedTag={selectedTag}
            onTagSelect={handleTagSelect}
          />
          
          {decisions.length === 0 ? (
            <div className="empty-state">
              <p>{selectedTag ? `No decisions with tag "${selectedTag}".` : 'No decisions recorded yet.'}</p>
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
                      {decision.tags && decision.tags.length > 0 && (
                        <div className="decision-tags">
                          {decision.tags.map(tag => (
                            <TagBadge key={tag.id} tag={tag} size="small" />
                          ))}
                        </div>
                      )}
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

      {activeTab === 'ocr' && (
        <section className="ocr-section">
          <ImageAnalyzer 
            projectId={Number(projectId)}
            onAnalysisComplete={loadData}
          />
        </section>
      )}
    </div>
  );
}
