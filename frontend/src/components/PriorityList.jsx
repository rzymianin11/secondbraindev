import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getTasksByProject, updateTask, cleanupDuplicateTasks, bulkUpdateTasks, archiveProject, getProjects } from '../api';
import TaskDetailModal from './TaskDetailModal';

const PRIORITY_CONFIG = {
  high: {
    label: 'Do First',
    icon: '🔴',
    color: '#ef4444',
    description: 'Critical tasks - do these immediately'
  },
  medium: {
    label: 'Do Next',
    icon: '🟡',
    color: '#f59e0b',
    description: 'Important tasks - schedule these soon'
  },
  low: {
    label: 'Do Later',
    icon: '🟢',
    color: '#10b981',
    description: 'Nice to have - when you have time'
  }
};

export default function PriorityList({ projectId, onTaskUpdate }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, all, done
  const [cleaning, setCleaning] = useState(false);
  const [cleanupStats, setCleanupStats] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    loadTasks();
    loadArchivedProjects();
  }, [projectId, filter]);

  async function loadArchivedProjects() {
    try {
      const projects = await getProjects();
      const archived = projects.filter(p => p.name.startsWith('[Archived'));
      setArchivedProjects(archived);
    } catch (err) {
      console.error('Failed to load archived projects:', err);
    }
  }

  async function loadTasks() {
    try {
      setLoading(true);
      const data = await getTasksByProject(projectId, 
        filter !== 'all' ? { status: filter } : {}
      );
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    try {
      await updateTask(taskId, { status: newStatus });
      loadTasks();
      if (onTaskUpdate) onTaskUpdate();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }

  async function handlePriorityChange(taskId, newPriority) {
    try {
      await updateTask(taskId, { priority: newPriority });
      loadTasks();
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  }

  async function handleCleanupDuplicates() {
    if (!confirm('This will remove duplicate tasks (keeping the oldest one). Continue?')) return;
    
    setCleaning(true);
    try {
      const result = await cleanupDuplicateTasks(projectId);
      setCleanupStats(result);
      loadTasks();
      if (onTaskUpdate) onTaskUpdate();
      setTimeout(() => setCleanupStats(null), 5000);
    } catch (err) {
      console.error('Cleanup failed:', err);
      alert('Failed to cleanup: ' + err.message);
    } finally {
      setCleaning(false);
    }
  }

  async function handleMarkAllDone(priority) {
    const tasksToMark = groupedTasks[priority].filter(t => t.status !== 'done');
    if (tasksToMark.length === 0) return;
    
    if (!confirm(`Mark ${tasksToMark.length} ${priority} priority tasks as done?`)) return;
    
    try {
      await bulkUpdateTasks(tasksToMark.map(t => t.id), { status: 'done' });
      loadTasks();
      if (onTaskUpdate) onTaskUpdate();
    } catch (err) {
      console.error('Bulk update failed:', err);
    }
  }

  async function handleArchiveProject() {
    if (!confirm('Archive this project and start fresh?\n\nThis will:\n• Rename current project to [Archived]\n• Create a new empty project with the same name\n• Keep all archived data accessible')) return;
    
    setArchiving(true);
    try {
      const result = await archiveProject(projectId);
      alert(`Archived! ${result.archived.tasks} tasks and ${result.archived.decisions} decisions saved.`);
      navigate(`/project/${result.newProject.id}`);
    } catch (err) {
      console.error('Archive failed:', err);
      alert('Failed to archive: ' + err.message);
    } finally {
      setArchiving(false);
    }
  }

  function handleTaskUpdate(updatedTask) {
    setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
    if (onTaskUpdate) onTaskUpdate();
  }

  const groupedTasks = {
    high: tasks.filter(t => t.priority === 'high'),
    medium: tasks.filter(t => t.priority === 'medium'),
    low: tasks.filter(t => t.priority === 'low')
  };

  const totalPending = tasks.filter(t => t.status !== 'done').length;

  if (loading) {
    return <div className="loading">Loading priorities...</div>;
  }

  return (
    <div className="priority-list">
      <div className="priority-header">
        <div className="priority-summary">
          <span className="priority-count">{totalPending}</span>
          <span className="priority-label">tasks to do</span>
        </div>
        <div className="priority-actions">
          <button 
            className="btn btn-small btn-cleanup"
            onClick={handleCleanupDuplicates}
            disabled={cleaning}
            title="Remove duplicate tasks"
          >
            {cleaning ? '...' : '🧹 Clean duplicates'}
          </button>
          <button 
            className="btn btn-small btn-archive"
            onClick={handleArchiveProject}
            disabled={archiving}
            title="Archive and start fresh"
          >
            {archiving ? '...' : '📦 Archive & Fresh Start'}
          </button>
        </div>
        <div className="priority-filters">
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            To Do
          </button>
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'done' ? 'active' : ''}`}
            onClick={() => setFilter('done')}
          >
            Done
          </button>
        </div>
      </div>

      {cleanupStats && (
        <div className="cleanup-stats">
          ✓ Cleaned up: {cleanupStats.deleted} duplicate(s) removed, {cleanupStats.remaining} tasks remain
        </div>
      )}

      {['high', 'medium', 'low'].map(priority => {
        const config = PRIORITY_CONFIG[priority];
        const priorityTasks = groupedTasks[priority];
        
        if (priorityTasks.length === 0) return null;
        
        return (
          <div key={priority} className={`priority-group priority-${priority}`}>
            <div className="priority-group-header">
              <span className="priority-icon">{config.icon}</span>
              <div className="priority-group-info">
                <h3>{config.label}</h3>
                <p>{config.description}</p>
              </div>
              {filter !== 'done' && priorityTasks.some(t => t.status !== 'done') && (
                <button 
                  className="btn-mark-all-done"
                  onClick={() => handleMarkAllDone(priority)}
                  title="Mark all as done"
                >
                  ✓ All done
                </button>
              )}
              <span className="priority-group-count">{priorityTasks.length}</span>
            </div>
            
            <ul className="priority-tasks">
              {priorityTasks.map(task => (
                <li key={task.id} className={`priority-task ${task.status === 'done' ? 'completed' : ''} ${task.notes ? 'has-notes' : ''}`}>
                  <button
                    className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(task.id, task.status === 'done' ? 'pending' : 'done');
                    }}
                    style={{ '--priority-color': config.color }}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </button>
                  
                  <span 
                    className="task-title clickable"
                    onClick={() => setSelectedTask(task)}
                  >
                    {task.title}
                    {task.notes && <span className="task-notes-indicator">📝</span>}
                  </span>
                  
                  <select
                    className="priority-select"
                    value={task.priority}
                    onChange={(e) => {
                      e.stopPropagation();
                      handlePriorityChange(task.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ '--select-color': PRIORITY_CONFIG[task.priority].color }}
                  >
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {tasks.length === 0 && (
        <div className="priority-empty">
          <p>No tasks {filter === 'done' ? 'completed' : 'to do'} yet.</p>
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div className="archived-section">
          <div className="archived-section-header">
            <span className="archived-icon">📦</span>
            <h3>Saved Boards</h3>
            <span className="archived-count">{archivedProjects.length}</span>
          </div>
          <ul className="archived-list">
            {archivedProjects.map(project => {
              const dateMatch = project.name.match(/\d{4}-\d{2}-\d{2}/);
              const cleanName = project.name.replace(/^\[Archived \d{4}-\d{2}-\d{2}\] /, '');
              return (
                <li key={project.id} className="archived-item">
                  <Link to={`/project/${project.id}`} className="archived-link">
                    <span className="archived-name">{cleanName}</span>
                    <span className="archived-date">{dateMatch?.[0] || ''}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}
    </div>
  );
}
