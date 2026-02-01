import { useState, useEffect, useRef } from 'react';
import { updateProject } from '../api';

export default function EditProjectModal({ project, isOpen, onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const modalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (project && isOpen) {
      setName(project.name || '');
      setDescription(project.description || '');
      setError(null);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [project, isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    
    function handleClickOutside(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null
      });
      onSave(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" ref={modalRef}>
        <div className="modal-header">
          <h2>Edit Project</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="form-error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="project-name">Project Name</label>
            <input
              ref={inputRef}
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="project-description">Description</label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description (optional)"
              rows={4}
              disabled={loading}
            />
          </div>
          
          <div className="modal-actions">
            <button 
              type="button" 
              className="btn" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
