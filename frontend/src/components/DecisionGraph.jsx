import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';

const RELATION_COLORS = {
  supersedes: '#ef4444',
  relates: '#667eea',
  blocks: '#f59e0b',
  implements: '#10b981'
};

const RELATION_LABELS = {
  supersedes: 'supersedes',
  relates: 'relates to',
  blocks: 'blocks',
  implements: 'implements'
};

export default function DecisionGraph({ nodes, edges, onNodeClick }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const navigate = useNavigate();

  useEffect(() => {
    function updateDimensions() {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    }
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !nodes || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create container for zoom/pan
    const container = svg.append('g');

    // Create arrow markers for different relation types
    const defs = svg.append('defs');
    Object.entries(RELATION_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', color)
        .attr('d', 'M0,-5L10,0L0,5');
    });

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges)
        .id(d => d.id)
        .distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    // Create links
    const link = container.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('class', d => `graph-link ${d.relationType}`)
      .attr('stroke', d => RELATION_COLORS[d.relationType] || '#667eea')
      .attr('stroke-width', 2)
      .attr('marker-end', d => `url(#arrow-${d.relationType})`);

    // Create link labels
    const linkLabels = container.append('g')
      .selectAll('text')
      .data(edges)
      .join('text')
      .attr('class', 'graph-link-label')
      .attr('fill', d => RELATION_COLORS[d.relationType] || '#667eea')
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .text(d => RELATION_LABELS[d.relationType] || d.relationType);

    // Create node groups
    const node = container.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'graph-node')
      .call(drag(simulation));

    // Add circles to nodes
    node.append('circle')
      .attr('r', 20)
      .attr('fill', d => {
        if (d.tags && d.tags.length > 0) {
          return d.tags[0].color;
        }
        return '#667eea';
      })
      .attr('stroke', 'rgba(255,255,255,0.3)')
      .attr('stroke-width', 2);

    // Add labels to nodes
    node.append('text')
      .attr('dy', 35)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.9)')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text(d => d.title.length > 20 ? d.title.slice(0, 20) + '...' : d.title);

    // Add click handler
    node.on('click', (event, d) => {
      event.stopPropagation();
      if (onNodeClick) {
        onNodeClick(d);
      } else {
        navigate(`/decision/${d.id}`);
      }
    });

    // Add hover effects
    node.on('mouseenter', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', 25)
        .attr('stroke-width', 3);
    })
    .on('mouseleave', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', 20)
        .attr('stroke-width', 2);
    });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkLabels
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag behavior
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, dimensions, navigate, onNodeClick]);

  function handleZoomIn() {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom().scaleBy,
      1.3
    );
  }

  function handleZoomOut() {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom().scaleBy,
      0.7
    );
  }

  function handleReset() {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom().transform,
      d3.zoomIdentity
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="graph-container">
        <div className="empty-state">
          <p>No decisions to visualize yet.</p>
          <p>Create decisions and add relations to see the graph.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-container" ref={containerRef}>
      <svg ref={svgRef} className="graph-svg" />
      
      <div className="graph-controls">
        <button onClick={handleZoomIn} title="Zoom in">+</button>
        <button onClick={handleZoomOut} title="Zoom out">-</button>
        <button onClick={handleReset} title="Reset view">R</button>
      </div>

      <div className="graph-legend">
        {Object.entries(RELATION_COLORS).map(([type, color]) => (
          <div key={type} className="graph-legend-item">
            <div 
              className="graph-legend-line" 
              style={{ backgroundColor: color }}
            />
            <span>{RELATION_LABELS[type]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
