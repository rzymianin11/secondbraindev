import { useState, useEffect, useRef } from 'react';

export default function QuickNotes() {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(true);
  const textareaRef = useRef(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('quickNotes');
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, []);

  // Auto-save notes with debounce
  useEffect(() => {
    if (!saved) {
      const timer = setTimeout(() => {
        localStorage.setItem('quickNotes', notes);
        setSaved(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [notes, saved]);

  // Focus textarea when opening
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  function handleChange(e) {
    setNotes(e.target.value);
    setSaved(false);
  }

  function handleClear() {
    if (confirm('Clear all quick notes?')) {
      setNotes('');
      localStorage.removeItem('quickNotes');
      setSaved(true);
    }
  }

  // Keyboard shortcut: Cmd/Ctrl + Shift + N
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Floating Button */}
      <button 
        className={`quick-notes-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Quick Notes (⌘⇧N)"
      >
        {isOpen ? '✕' : '📝'}
      </button>

      {/* Notes Panel */}
      {isOpen && (
        <div className="quick-notes-panel">
          <div className="quick-notes-header">
            <div className="quick-notes-title">
              <span className="notes-icon">🔥</span>
              <h3>Hot Notes</h3>
            </div>
            <div className="quick-notes-status">
              {saved ? (
                <span className="status-saved">✓ Saved</span>
              ) : (
                <span className="status-saving">Saving...</span>
              )}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            className="quick-notes-textarea"
            value={notes}
            onChange={handleChange}
            placeholder="Quick thoughts, ideas, reminders...

Keyboard shortcut: ⌘⇧N to toggle"
          />

          <div className="quick-notes-footer">
            <span className="notes-hint">Auto-saved locally</span>
            <button 
              className="btn-clear-notes"
              onClick={handleClear}
              title="Clear all notes"
            >
              🗑️ Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}
