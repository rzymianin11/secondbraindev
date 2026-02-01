import { useState, useRef } from 'react';
import { analyzeImage } from '../api';

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
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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
      const response = await analyzeImage(projectId, file, analysisType);
      setResult(response.analysis);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(response.analysis);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleReset() {
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

      {!preview ? (
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
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
              <button className="btn btn-small" onClick={() => analyzeFile(preview)}>
                Retry
              </button>
            </div>
          )}

          {result && (
            <div className="analysis-result">
              {result.summary && (
                <div className="result-section">
                  <h4>Summary</h4>
                  <p className="result-summary">{result.summary}</p>
                </div>
              )}

              {result.extractedText && (
                <div className="result-section">
                  <h4>Extracted Text</h4>
                  <pre className="result-text">{result.extractedText}</pre>
                </div>
              )}

              {result.tasks && result.tasks.length > 0 && (
                <div className="result-section">
                  <h4>Extracted Tasks ({result.tasks.length})</h4>
                  <ul className="result-tasks">
                    {result.tasks.map((task, i) => (
                      <li key={i} className="result-task-item">
                        <span className="task-check">✓</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                  <p className="tasks-note">Tasks have been automatically added to your project.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
