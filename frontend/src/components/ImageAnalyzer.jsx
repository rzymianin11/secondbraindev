import { useState, useRef, useEffect } from 'react';
import { analyzeImage, getImageAnalyses, saveOcrTasks } from '../api';

const ANALYSIS_TYPES = [
  { value: 'conversation', label: 'Conversation / Chat', icon: '💬' },
  { value: 'document', label: 'Document', icon: '📄' },
  { value: 'screenshot', label: 'Screenshot', icon: '🖥️' },
  { value: 'whiteboard', label: 'Whiteboard / Diagram', icon: '📋' }
];

export default function ImageAnalyzer({ projectId, onAnalysisComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState('conversation');
  const [preview, setPreview] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const [tasksSaved, setTasksSaved] = useState(false);
  const [saveStats, setSaveStats] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  async function loadHistory() {
    try {
      const analyses = await getImageAnalyses(projectId);
      setHistory(analyses);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleFile(file) {
    // Store file for retry
    setCurrentFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    // Analyze
    analyzeFile(file);
  }

  async function analyzeFile(file) {
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      console.log('Starting analysis...');
      const response = await analyzeImage(projectId, file, analysisType);
      console.log('Response:', response);
      console.log('Analysis:', response.analysis);
      setResult(response.analysis);
      console.log('Result set!');
      
      // Don't call onAnalysisComplete - it might be causing re-render issues
      // if (onAnalysisComplete) {
      //   onAnalysisComplete(response.analysis);
      // }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleReset() {
    setPreview(null);
    setCurrentFile(null);
    setResult(null);
    setError(null);
    setShowHistory(true);
    setTasksSaved(false);
    setSaveStats(null);
    loadHistory(); // Refresh history
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSaveTasks(mode) {
    if (!result?.tasks || result.tasks.length === 0) return;
    
    setSaving(true);
    try {
      const response = await saveOcrTasks(projectId, result.tasks, mode);
      setSaveStats(response.stats);
      setTasksSaved(true);
      if (onAnalysisComplete) {
        onAnalysisComplete();
      }
    } catch (err) {
      setError('Failed to save tasks: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleRetry() {
    if (currentFile) {
      analyzeFile(currentFile);
    }
  }

  function viewHistoryItem(item) {
    setShowHistory(false);
    setPreview(`/api/ocr/image/${item.filename}`);
    setResult({
      extractedText: item.extractedText,
      summary: item.summary,
      tasks: item.tasks || []
    });
    setError(null);
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFile(file);
        }
        break;
      }
    }
  }

  return (
    <div className="image-analyzer" onPaste={handlePaste}>
      <div className="analyzer-header">
        <h3>Image Analysis (OCR)</h3>
        <div className="analysis-type-selector">
          {ANALYSIS_TYPES.map(type => (
            <button
              key={type.value}
              className={`type-btn ${analysisType === type.value ? 'active' : ''}`}
              onClick={() => setAnalysisType(type.value)}
              disabled={analyzing}
            >
              <span className="type-icon">{type.icon}</span>
              <span className="type-label">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* History thumbnails - always visible when no preview */}
      {!preview && history.length > 0 && (
        <div className="image-history-thumbnails">
          {history.slice(0, 8).map(item => (
            <button
              key={item.id}
              className="history-thumbnail"
              onClick={() => viewHistoryItem(item)}
              title={item.summary || 'View analysis'}
            >
              <img 
                src={`/api/ocr/image/${item.filename}`} 
                alt="Previous analysis"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="thumbnail-fallback" style={{ display: 'none' }}>
                {ANALYSIS_TYPES.find(t => t.value === item.analysisType)?.icon || '📷'}
              </div>
              {item.tasks && item.tasks.length > 0 && (
                <span className="thumbnail-badge">{item.tasks.length}</span>
              )}
            </button>
          ))}
          <button
            className="history-thumbnail add-new"
            onClick={() => fileInputRef.current?.click()}
            title="Upload new image"
          >
            <span>+</span>
          </button>
        </div>
      )}

      {!preview ? (
        <>
          <div
            className={`drop-zone ${isDragging ? 'dragging' : ''} ${history.length > 0 ? 'compact' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <div className="drop-zone-content">
              <div className="drop-icon">📷</div>
              <p className="drop-text">
                Drop image here, click to select, or <kbd>Ctrl+V</kbd> to paste
              </p>
              <p className="drop-hint">
                Supports: JPEG, PNG, GIF, WebP (max 20MB)
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="analyzer-content">
          <div className="preview-section">
            <img src={preview} alt="Preview" className="image-preview" />
            <button className="btn btn-small" onClick={handleReset}>
              New Image
            </button>
          </div>

          {analyzing && (
            <div className="analyzing-state">
              <div className="spinner"></div>
              <p>Analyzing image with AI...</p>
            </div>
          )}

          {error && (
            <div className="analyzer-error">
              <p>{error}</p>
              <button className="btn btn-small" onClick={handleRetry}>
                Retry
              </button>
            </div>
          )}

          {result && console.log('Rendering result:', result)}
          {result && (
            <div className="analysis-result">
              <div className="result-success">✓ Analysis complete</div>
              
              {result.summary ? (
                <div className="result-section">
                  <h4>Summary</h4>
                  <p className="result-summary">{result.summary}</p>
                </div>
              ) : null}

              {result.extractedText ? (
                <div className="result-section">
                  <h4>Extracted Text</h4>
                  <pre className="result-text">{result.extractedText}</pre>
                </div>
              ) : null}

              {result.tasks && result.tasks.length > 0 ? (
                <div className="result-section">
                  <h4>Extracted Tasks ({result.tasks.length})</h4>
                  <ul className="result-tasks">
                    {result.tasks.map((task, i) => {
                      const title = typeof task === 'string' ? task : task.title;
                      const isDone = typeof task === 'object' && task.status === 'done';
                      return (
                        <li key={i} className={`result-task-item ${isDone ? 'task-done' : ''}`}>
                          <span className="task-check">{isDone ? '✓' : '○'}</span>
                          <span className={isDone ? 'task-strikethrough' : ''}>{title}</span>
                          {isDone && <span className="task-status-badge">Done</span>}
                        </li>
                      );
                    })}
                  </ul>
                  
                  {!tasksSaved ? (
                    <div className="tasks-actions">
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleSaveTasks('merge')}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Merge with Existing'}
                      </button>
                      <button 
                        className="btn"
                        onClick={() => handleSaveTasks('create_new')}
                        disabled={saving}
                      >
                        Create All as New
                      </button>
                    </div>
                  ) : (
                    <p className="tasks-note tasks-saved">
                      ✓ {saveStats?.created > 0 && `${saveStats.created} task(s) created. `}
                      {saveStats?.updated > 0 && `${saveStats.updated} task(s) updated. `}
                      {saveStats?.skipped > 0 && `${saveStats.skipped} already existed. `}
                    </p>
                  )}
                </div>
              ) : null}

              {!result.summary && !result.extractedText && (!result.tasks || result.tasks.length === 0) && (
                <div className="result-section">
                  <p className="result-empty">No text or tasks extracted from this image.</p>
                  <pre className="result-raw">{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
