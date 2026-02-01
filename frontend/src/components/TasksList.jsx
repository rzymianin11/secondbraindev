import { useState } from 'react';
import { updateTask, deleteTask, createTask } from '../api';

export default function TasksList({ tasks, projectId, onTaskUpdate, compact = false }) {
  const [editingId, setEditingId] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(null);

  async function handleStatusChange(taskId, newStatus) {
    try {
      setLoading(taskId);
      await updateTask(taskId, { status: newStatus });
      if (onTaskUpdate) onTaskUpdate();
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setLoading(null);
    }
  }

  async function handlePriorityChange(taskId, newPriority) {
    try {
      setLoading(taskId);
      await updateTask(taskId, { priority: newPriority });
      if (onTaskUpdate) onTaskUpdate();
    } catch (err) {
      console.error('Failed to update priority:', err);
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete(taskId) {
    if (!confirm('Delete this task?')) return;
    try {
      setLoading(taskId);
      await deleteTask(taskId);
      if (onTaskUpdate) onTaskUpdate();
    } catch (err) {
      console.error('Failed to delete task:', err);
    } finally {
      setLoading(null);
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTaskTitle.trim() || !projectId) return;
    
    try {
      setLoading('new');
      await createTask({
        projectId,
        title: newTaskTitle.trim(),
        priority: 'medium'
      });
      setNewTaskTitle('');
      setShowAddForm(false);
      if (onTaskUpdate) onTaskUpdate();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setLoading(null);
    }
  }

  function getPriorityClass(priority) {
    return `priority-${priority}`;
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'done': return '✓';
      case 'in_progress': return '◐';
      default: return '○';
    }
  }

  if (tasks.length === 0 && !showAddForm) {
    return (
      <div className="tasks-empty">
        <p className="empty-hint">No tasks yet.</p>
        {projectId && (
          <button 
            className="btn btn-small"
            onClick={() => setShowAddForm(true)}
          >
            Add Task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`tasks-list ${compact ? 'compact' : ''}`}>
      <ul className="task-items">
        {tasks.map(task => (
          <li 
            key={task.id} 
            className={`task-item ${task.status === 'done' ? 'task-done' : ''} ${loading === task.id ? 'loading' : ''}`}
          >
            <button
              className={`task-status-btn ${task.status}`}
              onClick={() => handleStatusChange(
                task.id, 
                task.status === 'done' ? 'pending' : 
                task.status === 'pending' ? 'in_progress' : 'done'
              )}
              title={`Status: ${task.status}`}
            >
              {getStatusIcon(task.status)}
            </button>
            
            <span className={`task-priority ${getPriorityClass(task.priority)}`}>
              {task.priority[0].toUpperCase()}
            </span>
            
            <span className="task-title">{task.title}</span>
            
            {!compact && (
              <div className="task-actions">
                <select
                  value={task.priority}
                  onChange={(e) => handlePriorityChange(task.id, e.target.value)}
                  className="task-priority-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                
                <button
                  className="btn-icon"
                  onClick={() => handleDelete(task.id)}
                  title="Delete task"
                >
                  ×
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {projectId && (
        <>
          {showAddForm ? (
            <form className="add-task-form" onSubmit={handleAddTask}>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="New task..."
                autoFocus
              />
              <button type="submit" className="btn btn-primary btn-small" disabled={loading === 'new'}>
                Add
              </button>
              <button 
                type="button" 
                className="btn btn-small"
                onClick={() => {
                  setShowAddForm(false);
                  setNewTaskTitle('');
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button 
              className="btn btn-small add-task-btn"
              onClick={() => setShowAddForm(true)}
            >
              + Add Task
            </button>
          )}
        </>
      )}
    </div>
  );
}
