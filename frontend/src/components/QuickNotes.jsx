import { useState, useEffect, useRef } from 'react';

export default function QuickNotes() {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(true);
  const [panelHeight, setPanelHeight] = useState(400);
  const textareaRef = useRef(null);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('quickNotes');
    if (savedNotes) {
      setNotes(savedNotes);
    }
    const savedHeight = localStorage.getItem('quickNotesHeight');
    if (savedHeight) {
      setPanelHeight(parseInt(savedHeight));
    }
  }, []);

  // Resize handlers
  function handleResizeStart(e) {
    isResizing.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }

  function handleResizeMove(e) {
    if (!isResizing.current) return;
    const diff = startY.current - e.clientY;
    const newHeight = Math.min(Math.max(startHeight.current + diff, 200), window.innerHeight - 150);
    setPanelHeight(newHeight);
  }

  function handleResizeEnd() {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('quickNotesHeight', panelHeight.toString());
  }

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
        <div className="quick-notes-panel" style={{ height: panelHeight }}>
          <div 
            className="notes-resize-handle"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          />
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
