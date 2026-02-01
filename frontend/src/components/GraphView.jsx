import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, getGraphData } from '../api';
import DecisionGraph from './DecisionGraph';
import TagFilter from './TagFilter';

export default function GraphView() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);
      const [projectData, graph] = await Promise.all([
        getProject(projectId),
        getGraphData(projectId)
      ]);
      setProject(projectData);
      setGraphData(graph);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filter nodes by tag
  const filteredData = selectedTag
    ? {
        nodes: graphData.nodes.filter(n => 
          n.tags?.some(t => t.name === selectedTag)
        ),
        edges: graphData.edges.filter(e => {
          const sourceNode = graphData.nodes.find(n => n.id === e.source || n.id === e.source?.id);
          const targetNode = graphData.nodes.find(n => n.id === e.target || n.id === e.target?.id);
          return sourceNode?.tags?.some(t => t.name === selectedTag) ||
                 targetNode?.tags?.some(t => t.name === selectedTag);
        })
      }
    : graphData;

  if (loading) {
    return <div className="loading">Loading graph...</div>;
  }

  if (error) {
    return (
      <div className="error-state">
        <p className="error-message">{error}</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="graph-view">
      <div className="breadcrumb">
        <Link to="/">Projects</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to={`/project/${projectId}`}>{project?.name || 'Project'}</Link>
        <span className="breadcrumb-separator">/</span>
        <span>Decision Graph</span>
      </div>

      <div className="page-header">
        <h1>Decision Graph</h1>
        <Link to={`/project/${projectId}`} className="btn">
          Back to Dashboard
        </Link>
      </div>

      <TagFilter 
        projectId={Number(projectId)}
        selectedTag={selectedTag}
        onTagSelect={setSelectedTag}
      />

      <DecisionGraph 
        nodes={filteredData.nodes} 
        edges={filteredData.edges}
      />

      <div className="graph-stats">
        <span>{filteredData.nodes.length} decisions</span>
        <span className="separator">·</span>
        <span>{filteredData.edges.length} relations</span>
      </div>
    </div>
  );
}
