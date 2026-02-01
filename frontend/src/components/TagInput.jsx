import { useState, useRef, useEffect } from 'react';
import { getTagsByProject, addTagToDecision } from '../api';
import TagBadge from './TagBadge';

const PRESET_TAGS = [
  { name: 'architecture', color: '#8b5cf6' },
  { name: 'security', color: '#ef4444' },
  { name: 'performance', color: '#f59e0b' },
  { name: 'database', color: '#10b981' },
  { name: 'api', color: '#3b82f6' },
  { name: 'frontend', color: '#ec4899' },
  { name: 'devops', color: '#6366f1' },
  { name: 'testing', color: '#14b8a6' }
];

export default function TagInput({ 
  projectId, 
  decisionId, 
  selectedTags = [], 
  onTagsChange,
  placeholder = "Add tags..."
}) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (projectId) {
      loadProjectTags();
    }
  }, [projectId]);

  useEffect(() => {
    // Close suggestions on click outside
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadProjectTags() {
    try {
      const tags = await getTagsByProject(projectId);
      setProjectTags(tags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }

  function filterSuggestions(value) {
    const search = value.toLowerCase().trim();
    if (!search) {
      // Show preset tags that aren't selected
      return PRESET_TAGS.filter(t => 
        !selectedTags.some(st => st.name === t.name)
      );
    }
    
    // Combine project tags and presets
    const allTags = [
      ...projectTags,
      ...PRESET_TAGS.filter(pt => !projectTags.some(t => t.name === pt.name))
    ];
    
    return allTags
      .filter(t => 
        t.name.includes(search) && 
        !selectedTags.some(st => st.name === t.name)
      )
      .slice(0, 8);
  }

  function handleInputChange(e) {
    const value = e.target.value;
    setInputValue(value);
    setSuggestions(filterSuggestions(value));
    setShowSuggestions(true);
  }

  function handleFocus() {
    setSuggestions(filterSuggestions(inputValue));
    setShowSuggestions(true);
  }

  async function handleSelectTag(tag) {
    setLoading(true);
    try {
      if (decisionId) {
        // Add to existing decision
        await addTagToDecision(decisionId, { 
          tagName: tag.name, 
          projectId 
        });
      }
      
      const newTag = projectTags.find(t => t.name === tag.name) || tag;
      onTagsChange([...selectedTags, newTag]);
      setInputValue('');
      setShowSuggestions(false);
      await loadProjectTags();
    } catch (err) {
      console.error('Failed to add tag:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleKeyDown(e) {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const tagName = inputValue.trim().toLowerCase();
      
      // Check if exact match in suggestions
      const existing = suggestions.find(s => s.name === tagName);
      if (existing) {
        await handleSelectTag(existing);
      } else {
        // Create new tag
        await handleSelectTag({ 
          name: tagName, 
          color: '#667eea' 
        });
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      // Remove last tag
      const lastTag = selectedTags[selectedTags.length - 1];
      handleRemoveTag(lastTag);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  function handleRemoveTag(tag) {
    onTagsChange(selectedTags.filter(t => t.name !== tag.name));
  }

  return (
    <div className="tag-input-container" ref={containerRef}>
      <div className="tag-input-wrapper">
        {selectedTags.map(tag => (
          <TagBadge 
            key={tag.id || tag.name} 
            tag={tag} 
            size="small"
            onRemove={handleRemoveTag}
          />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          className="tag-input"
          disabled={loading}
        />
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map(tag => (
            <button
              key={tag.name}
              className="tag-suggestion"
              onClick={() => handleSelectTag(tag)}
              style={{ '--tag-color': tag.color }}
            >
              <span 
                className="tag-suggestion-dot"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </button>
          ))}
          {inputValue && !suggestions.some(s => s.name === inputValue.toLowerCase()) && (
            <button
              className="tag-suggestion tag-suggestion-new"
              onClick={() => handleSelectTag({ name: inputValue.toLowerCase(), color: '#667eea' })}
            >
              Create "{inputValue.toLowerCase()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
