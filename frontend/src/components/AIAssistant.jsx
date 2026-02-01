import { useState, useRef, useEffect } from 'react';
import { askAssistant } from '../api';

// Simple markdown formatter for AI responses
function formatMessage(text) {
  if (!text) return '';
  
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Bullet points with dash
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Line breaks (but not inside tags)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

const QUICK_PROMPTS = [
  { label: 'What should I do first?', prompt: 'What task should I focus on first and why?' },
  { label: 'Summarize my tasks', prompt: 'Give me a quick summary of all my pending tasks' },
  { label: 'Any blockers?', prompt: 'Are there any potential blockers or dependencies I should be aware of?' },
  { label: 'Plan my day', prompt: 'Help me plan what to work on today based on priorities' },
];

export default function AIAssistant({ projectId, projectName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [panelHeight, setPanelHeight] = useState(500);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    const newHeight = Math.min(Math.max(startHeight.current + diff, 300), window.innerHeight - 150);
    setPanelHeight(newHeight);
  }

  function handleResizeEnd() {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  async function handleSend(customPrompt) {
    const question = customPrompt || input.trim();
    if (!question) return;

    const userMessage = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await askAssistant(projectId, question);
      const assistantMessage = { 
        role: 'assistant', 
        content: response.answer,
        context: response.context 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.',
        error: true 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating Button */}
      <button 
        className={`ai-assistant-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="AI Assistant"
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="ai-assistant-panel" style={{ height: panelHeight }}>
          <div 
            className="ai-resize-handle"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          />
          <div className="ai-assistant-header">
            <div className="ai-header-info">
              <span className="ai-avatar">🤖</span>
              <div>
                <h3>AI Assistant</h3>
                <p>Helping with {projectName}</p>
              </div>
            </div>
          </div>

          <div className="ai-assistant-messages">
            {messages.length === 0 && (
              <div className="ai-welcome">
                <p>Hi! I can help you with your project tasks.</p>
                <p className="ai-welcome-hint">Try asking:</p>
                <div className="ai-quick-prompts">
                  {QUICK_PROMPTS.map((item, i) => (
                    <button
                      key={i}
                      className="quick-prompt-btn"
                      onClick={() => handleSend(item.prompt)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role} ${msg.error ? 'error' : ''}`}>
                {msg.role === 'assistant' ? (
                  <div 
                    className="ai-message-content formatted"
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                ) : (
                  <div className="ai-message-content">
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="ai-message assistant">
                <div className="ai-message-content ai-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length > 0 && !loading && (
            <div className="ai-quick-actions">
              {QUICK_PROMPTS.slice(0, 2).map((item, i) => (
                <button
                  key={i}
                  className="quick-action-btn"
                  onClick={() => handleSend(item.prompt)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="ai-assistant-input">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your tasks..."
              rows={1}
              disabled={loading}
            />
            <button 
              className="ai-send-btn"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
