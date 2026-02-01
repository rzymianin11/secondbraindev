export default function TagBadge({ tag, onRemove, size = 'normal' }) {
  const sizeClasses = {
    small: 'tag-badge-sm',
    normal: 'tag-badge',
    large: 'tag-badge-lg'
  };

  return (
    <span 
      className={sizeClasses[size]}
      style={{ 
        '--tag-color': tag.color,
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        borderColor: `${tag.color}40`
      }}
    >
      <span className="tag-name">{tag.name}</span>
      {onRemove && (
        <button 
          className="tag-remove" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(tag);
          }}
          aria-label={`Remove ${tag.name} tag`}
        >
          ×
        </button>
      )}
    </span>
  );
}
