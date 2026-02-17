import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchProject } from '../api';
import TagBadge from './TagBadge';

export default function SearchBar({ projectId, tasks = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [taskResults, setTaskResults] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    
    function handleKeyDown(e) {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to close
      if (e.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    // Debounced search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (!query.trim() || !projectId) {
      setResults(null);
      setTaskResults([]);
      setAnswer(null);
      return;
    }

    // Search tasks locally (instant)
    const lowerQuery = query.toLowerCase();
    const matchedTasks = tasks.filter(task => 
      task.title?.toLowerCase().includes(lowerQuery) ||
      task.notes?.toLowerCase().includes(lowerQuery)
    ).slice(0, 5);
    setTaskResults(matchedTasks);
    setShowResults(true);
    
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await searchProject(projectId, query);
        setResults(response.results);
        setAnswer(response.answer);
        setShowResults(true);
      } catch (err) {
        setError(err.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, projectId, tasks]);

  function handleInputChange(e) {
    setQuery(e.target.value);
  }

  function handleFocus() {
    if (results) {
      setShowResults(true);
    }
  }

  function handleResultClick(decisionId) {
    setShowResults(false);
    setQuery('');
    navigate(`/decision/${decisionId}`);
  }

  function highlightText(text, searchQuery) {
    if (!text || !searchQuery) return text;
    
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchQuery.toLowerCase() 
        ? <mark key={i}>{part}</mark>
        : part
    );
  }

  function truncateText(text, maxLength = 150) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  if (!projectId) return null;

  return (
    <div className="search-bar" ref={containerRef}>
      <div className="search-input-wrapper">
        <span className="search-icon">S</span>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search decisions & tasks..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
        />
        <span className="search-shortcut">⌘K</span>
      </div>

      {showResults && (query.trim() || loading) && (
        <div className="search-results">
          {loading && (
            <div className="search-loading">
              <div className="spinner"></div>
              <span>Searching...</span>
            </div>
          )}

          {error && (
            <div className="search-empty">
              <p>Search failed: {error}</p>
            </div>
          )}

          {!loading && !error && taskResults.length > 0 && (
            <div className="search-section">
              <div className="search-section-label">📋 Tasks</div>
              {taskResults.map(task => (
                <div
                  key={task.id}
                  className={`search-result-item search-task-item ${task.status === 'done' ? 'done' : ''}`}
                >
                  <span className={`task-status-dot ${task.status}`}></span>
                  <div className="search-result-title">
                    {highlightText(task.title, query)}
                  </div>
                  <span className={`search-task-priority priority-${task.priority || 'medium'}`}>
                    {task.priority || 'medium'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && answer && (
            <div className="search-answer">
              <div className="search-answer-label">AI Answer</div>
              <div className="search-answer-text">{answer}</div>
            </div>
          )}

          {!loading && !error && results && results.length > 0 && (
            <div className="search-section">
              <div className="search-section-label">📝 Decisions</div>
              {results.map(result => (
                <button
                  key={result.id}
                  className="search-result-item"
                  onClick={() => handleResultClick(result.id)}
                >
                  <div className="search-result-title">
                    {highlightText(result.title, query)}
                  </div>
                  {result.description && (
                    <div className="search-result-snippet">
                      {highlightText(truncateText(result.description), query)}
                    </div>
                  )}
                  <div className="search-result-meta">
                    {result.score && (
                      <span>Relevance: {Math.round(result.score * 100)}%</span>
                    )}
                    {result.tags && result.tags.length > 0 && (
                      <div className="search-result-tags">
                        {result.tags.map(tag => (
                          <TagBadge key={tag.id} tag={tag} size="small" />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && results && results.length === 0 && taskResults.length === 0 && query.trim() && (
            <div className="search-empty">
              <p>No decisions found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
