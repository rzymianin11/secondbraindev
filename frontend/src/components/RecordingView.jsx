import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getRecording, deleteRecording, transcribeRecording, getProject } from '../api';
import TasksList from './TasksList';

export default function RecordingView() {
  const { recordingId } = useParams();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    loadRecording();
  }, [recordingId]);

  async function loadRecording() {
    try {
      setLoading(true);
      const data = await getRecording(recordingId);
      setRecording(data);
      
      const projectData = await getProject(data.projectId);
      setProject(projectData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTranscribe() {
    try {
      setTranscribing(true);
      setError(null);
      const result = await transcribeRecording(recordingId);
      setRecording(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setTranscribing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this recording and its associated tasks?')) return;
    
    try {
      await deleteRecording(recordingId);
      navigate(`/project/${recording.projectId}`);
    } catch (err) {
      setError(err.message);
    }
  }

  function formatDuration(seconds) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  function getStatusBadge(status) {
    const badges = {
      recording: { label: 'Recording', className: 'badge-recording' },
      processing: { label: 'Processing', className: 'badge-processing' },
      completed: { label: 'Completed', className: 'badge-completed' },
      failed: { label: 'Failed', className: 'badge-failed' }
    };
    return badges[status] || { label: status, className: '' };
  }

  if (loading) {
    return <div className="loading">Loading recording...</div>;
  }

  if (error && !recording) {
    return (
      <div className="error-state">
        <p className="error-message">{error}</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="error-state">
        <p>Recording not found.</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  const badge = getStatusBadge(recording.status);

  return (
    <div className="recording-view">
      <div className="breadcrumb">
        <Link to="/">Projects</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to={`/project/${recording.projectId}`}>{project?.name || 'Project'}</Link>
        <span className="breadcrumb-separator">/</span>
        <span>Recording</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <article className="recording-article">
        <header className="recording-header">
          <div className="recording-header-top">
            <h1>{recording.title}</h1>
            <span className={`badge ${badge.className}`}>{badge.label}</span>
          </div>
          <div className="recording-meta-line">
            <time>{formatDateTime(recording.createdAt)}</time>
            <span className="separator">·</span>
            <span>{formatDuration(recording.duration)}</span>
          </div>
        </header>

        {recording.status === 'failed' && (
          <div className="recording-action-section">
            <p>Transcription failed. You can try again:</p>
            <button 
              className="btn btn-primary" 
              onClick={handleTranscribe}
              disabled={transcribing}
            >
              {transcribing ? 'Transcribing...' : 'Retry Transcription'}
            </button>
          </div>
        )}

        {recording.status === 'processing' && !recording.transcript && (
          <div className="recording-action-section">
            <p>This recording hasn't been transcribed yet.</p>
            <button 
              className="btn btn-primary" 
              onClick={handleTranscribe}
              disabled={transcribing}
            >
              {transcribing ? 'Transcribing...' : 'Start Transcription'}
            </button>
          </div>
        )}

        {recording.transcript && (
          <section className="recording-section">
            <h2>Transcript</h2>
            <div className="transcript-content">
              {recording.transcript}
            </div>
          </section>
        )}

        <section className="recording-section">
          <h2>Extracted Tasks</h2>
          {recording.tasks && recording.tasks.length > 0 ? (
            <TasksList 
              tasks={recording.tasks} 
              onTaskUpdate={loadRecording}
              compact
            />
          ) : (
            <p className="empty-hint">
              {recording.status === 'completed' 
                ? 'No tasks were extracted from this recording.'
                : 'Tasks will appear here after transcription.'}
            </p>
          )}
        </section>

        <footer className="recording-footer">
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete Recording
          </button>
        </footer>
      </article>
    </div>
  );
}
