import { useState, useEffect } from 'react';
import { getTasksByProject, updateTask } from '../api';

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
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, all, done

  useEffect(() => {
    loadTasks();
  }, [projectId, filter]);

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
              <span className="priority-group-count">{priorityTasks.length}</span>
            </div>
            
            <ul className="priority-tasks">
              {priorityTasks.map(task => (
                <li key={task.id} className={`priority-task ${task.status === 'done' ? 'completed' : ''}`}>
                  <button
                    className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`}
                    onClick={() => handleStatusChange(task.id, task.status === 'done' ? 'pending' : 'done')}
                    style={{ '--priority-color': config.color }}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </button>
                  
                  <span className="task-title">{task.title}</span>
                  
                  <select
                    className="priority-select"
                    value={task.priority}
                    onChange={(e) => handlePriorityChange(task.id, e.target.value)}
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
    </div>
  );
}
