import { useState, useEffect, useRef } from 'react';
import { updateTask, askTaskAssistant } from '../api';

const PRIORITY_CONFIG = {
  high: { label: 'High', icon: '🔴', color: '#ef4444' },
  medium: { label: 'Medium', icon: '🟡', color: '#f59e0b' },
  low: { label: 'Low', icon: '🟢', color: '#10b981' }
};

export default function TaskDetailModal({ task, projectId, onClose, onUpdate }) {
  const [notes, setNotes] = useState(task.notes || '');
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [saving, setSaving] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const notesRef = useRef(null);

  useEffect(() => {
    // Focus notes on open
    if (notesRef.current) {
      notesRef.current.focus();
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateTask(task.id, { notes, status, priority });
      onUpdate(updated);
      onClose();
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAskAI() {
    if (!aiQuestion.trim()) return;
    
    setAiLoading(true);
    try {
      const response = await askTaskAssistant(projectId, task, aiQuestion);
      setAiResponse(response.answer);
    } catch (err) {
      setAiResponse('Sorry, I encountered an error. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && aiQuestion.trim()) {
      e.preventDefault();
      handleAskAI();
    }
  }

  const quickPrompts = [
    { label: 'How to approach this?', prompt: 'How should I approach this task? Give me step-by-step guidance.' },
    { label: 'Break it down', prompt: 'Break this task into smaller sub-tasks.' },
    { label: 'Potential issues?', prompt: 'What potential issues or blockers should I watch out for?' },
    { label: 'Time estimate', prompt: 'How long might this task take and why?' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={e => e.stopPropagation()}>
        <div className="task-modal-header">
          <div className="task-modal-title">
            <span className={`task-status-indicator ${status}`}></span>
            <h2>{task.title}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="task-modal-body">
          <div className="task-modal-controls">
            <div className="control-group">
              <label>Status</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)}
                className="task-status-select"
              >
                <option value="pending">○ To Do</option>
                <option value="in_progress">◐ In Progress</option>
                <option value="done">✓ Done</option>
              </select>
            </div>
            <div className="control-group">
              <label>Priority</label>
              <select 
                value={priority} 
                onChange={e => setPriority(e.target.value)}
                className="task-priority-select"
                style={{ '--select-color': PRIORITY_CONFIG[priority].color }}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>

          <div className="task-notes-section">
            <label>Notes</label>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes, ideas, links, or any details about this task..."
              rows={5}
            />
          </div>

          <div className="task-ai-section">
            <div className="ai-section-header">
              <span className="ai-icon">🤖</span>
              <label>Ask AI for Help</label>
            </div>
            
            <div className="ai-quick-prompts">
              {quickPrompts.map((item, i) => (
                <button
                  key={i}
                  className="ai-quick-btn"
                  onClick={() => {
                    setAiQuestion(item.prompt);
                    setTimeout(() => handleAskAI(), 100);
                  }}
                  disabled={aiLoading}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="ai-input-row">
              <input
                type="text"
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about this task..."
                disabled={aiLoading}
              />
              <button 
                className="btn btn-primary"
                onClick={handleAskAI}
                disabled={aiLoading || !aiQuestion.trim()}
              >
                {aiLoading ? '...' : 'Ask'}
              </button>
            </div>

            {aiResponse && (
              <div className="ai-response">
                <div className="ai-response-content">{aiResponse}</div>
                <button 
                  className="ai-copy-btn"
                  onClick={() => {
                    setNotes(prev => prev ? `${prev}\n\n--- AI Suggestion ---\n${aiResponse}` : `--- AI Suggestion ---\n${aiResponse}`);
                  }}
                >
                  📋 Copy to Notes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="task-modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
