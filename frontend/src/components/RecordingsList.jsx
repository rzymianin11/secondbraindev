import { Link } from 'react-router-dom';

export default function RecordingsList({ recordings, projectId }) {
  function formatDuration(seconds) {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
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

  if (recordings.length === 0) {
    return (
      <div className="empty-hint">
        No recordings yet. Use the Record button to capture a conversation.
      </div>
    );
  }

  return (
    <ul className="recordings-list">
      {recordings.map(recording => {
        const badge = getStatusBadge(recording.status);
        return (
          <li key={recording.id} className="recording-item">
            <Link to={`/recording/${recording.id}`} className="recording-link">
              <div className="recording-info">
                <span className="recording-title">{recording.title}</span>
                <span className="recording-meta">
                  {formatDate(recording.createdAt)} · {formatDuration(recording.duration)}
                </span>
              </div>
              <span className={`badge ${badge.className}`}>
                {badge.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
