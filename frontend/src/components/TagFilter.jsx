import { useState, useEffect } from 'react';
import { getTagsByProject } from '../api';

export default function TagFilter({ projectId, selectedTag, onTagSelect }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, [projectId]);

  async function loadTags() {
    try {
      setLoading(true);
      const data = await getTagsByProject(projectId);
      setTags(data);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || tags.length === 0) {
    return null;
  }

  return (
    <div className="tag-filter">
      <button
        className={`tag-filter-btn ${!selectedTag ? 'active' : ''}`}
        onClick={() => onTagSelect(null)}
      >
        All
      </button>
      {tags.map(tag => (
        <button
          key={tag.id}
          className={`tag-filter-btn ${selectedTag === tag.name ? 'active' : ''}`}
          onClick={() => onTagSelect(selectedTag === tag.name ? null : tag.name)}
          style={{ 
            '--tag-color': tag.color,
            ...(selectedTag === tag.name && {
              backgroundColor: `${tag.color}30`,
              borderColor: tag.color,
              color: tag.color
            })
          }}
        >
          <span 
            className="tag-filter-dot"
            style={{ backgroundColor: tag.color }}
          />
          {tag.name}
          {tag.usageCount > 0 && (
            <span className="tag-filter-count">{tag.usageCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
