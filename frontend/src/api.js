const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Projects
export const getProjects = () => request('/projects');
export const getProject = (id) => request(`/projects/${id}`);
export const createProject = (data) => request('/projects', {
  method: 'POST',
  body: JSON.stringify(data)
});
export const updateProject = (id, data) => request(`/projects/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(data)
});
export const deleteProject = (id) => request(`/projects/${id}`, {
  method: 'DELETE'
});

// Decisions
export const getDecisionsByProject = (projectId) => request(`/decisions/project/${projectId}`);
export const getDecision = (id) => request(`/decisions/${id}`);
export const createDecision = (data) => request('/decisions', {
  method: 'POST',
  body: JSON.stringify(data)
});
export const deleteDecision = (id) => request(`/decisions/${id}`, {
  method: 'DELETE'
});

// Links
export const addLink = (decisionId, data) => request(`/decisions/${decisionId}/links`, {
  method: 'POST',
  body: JSON.stringify(data)
});
export const deleteLink = (linkId) => request(`/decisions/links/${linkId}`, {
  method: 'DELETE'
});

// Recordings
export const getRecordingsByProject = (projectId) => request(`/recordings/project/${projectId}`);
export const getRecording = (id) => request(`/recordings/${id}`);
export const deleteRecording = (id) => request(`/recordings/${id}`, {
  method: 'DELETE'
});
export const transcribeRecording = (id) => request(`/recordings/${id}/transcribe`, {
  method: 'POST'
});
export const getOpenAIStatus = () => request('/recordings/status/openai');

// Upload recording (special handling for FormData)
export async function uploadRecording(projectId, audioBlob, title, duration) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('projectId', projectId);
  formData.append('title', title || `Recording ${new Date().toLocaleString()}`);
  if (duration) {
    formData.append('duration', Math.round(duration));
  }
  
  const response = await fetch(`${API_BASE}/recordings/upload`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Upload failed');
  }
  
  return response.json();
}

// Tasks
export const getTasksByProject = (projectId, filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const query = params ? `?${params}` : '';
  return request(`/tasks/project/${projectId}${query}`);
};
export const getTask = (id) => request(`/tasks/${id}`);
export const createTask = (data) => request('/tasks', {
  method: 'POST',
  body: JSON.stringify(data)
});
export const updateTask = (id, data) => request(`/tasks/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(data)
});
export const deleteTask = (id) => request(`/tasks/${id}`, {
  method: 'DELETE'
});

// Tags
export const getTagsByProject = (projectId) => request(`/tags/project/${projectId}`);
export const createTag = (data) => request('/tags', {
  method: 'POST',
  body: JSON.stringify(data)
});
export const updateTag = (id, data) => request(`/tags/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(data)
});
export const deleteTag = (id) => request(`/tags/${id}`, {
  method: 'DELETE'
});
export const addTagToDecision = (decisionId, data) => request(`/tags/decision/${decisionId}`, {
  method: 'POST',
  body: JSON.stringify(data)
});
export const removeTagFromDecision = (decisionId, tagId) => request(`/tags/decision/${decisionId}/tag/${tagId}`, {
  method: 'DELETE'
});
export const getDecisionTags = (decisionId) => request(`/tags/decision/${decisionId}`);
export const getPredefinedColors = () => request('/tags/colors/predefined');

// Relations
export const getRelationsByProject = (projectId) => request(`/relations/project/${projectId}`);
export const getRelationsByDecision = (decisionId) => request(`/relations/decision/${decisionId}`);
export const createRelation = (data) => request('/relations', {
  method: 'POST',
  body: JSON.stringify(data)
});
export const deleteRelation = (id) => request(`/relations/${id}`, {
  method: 'DELETE'
});
export const getGraphData = (projectId) => request(`/relations/graph/${projectId}`);
export const getRelationTypes = () => request('/relations/types');

// Decisions with filters
export const getDecisionsByProjectWithFilter = (projectId, tag) => {
  const query = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  return request(`/decisions/project/${projectId}${query}`);
};

// Search
export const searchProject = (projectId, query) => request('/search', {
  method: 'POST',
  body: JSON.stringify({ projectId, query })
});

// OCR / Image Analysis
export async function analyzeImage(projectId, imageFile, analysisType = 'conversation') {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('projectId', projectId);
  formData.append('analysisType', analysisType);
  
  const response = await fetch(`${API_BASE}/ocr/analyze`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Analysis failed' }));
    throw new Error(error.error || 'Analysis failed');
  }
  
  return response.json();
}

export const getImageAnalyses = (projectId) => request(`/ocr/project/${projectId}`);
export const getImageAnalysis = (id) => request(`/ocr/${id}`);
export const deleteImageAnalysis = (id) => request(`/ocr/${id}`, { method: 'DELETE' });
export const saveOcrTasks = (projectId, tasks, mode = 'merge') => request('/ocr/save-tasks', {
  method: 'POST',
  body: JSON.stringify({ projectId, tasks, mode })
});

export const reanalyzeImage = (projectId, filename, analysisType = 'conversation') => request('/ocr/reanalyze', {
  method: 'POST',
  body: JSON.stringify({ projectId, filename, analysisType })
});

// Task cleanup
export const cleanupDuplicateTasks = (projectId) => request(`/tasks/cleanup/${projectId}`, {
  method: 'POST'
});

export const bulkUpdateTasks = (taskIds, updates) => request('/tasks/bulk-update', {
  method: 'POST',
  body: JSON.stringify({ taskIds, updates })
});

export const archiveProject = (projectId) => request(`/projects/${projectId}/archive`, {
  method: 'POST'
});

// AI Assistant
export const askAssistant = (projectId, question) => request('/assistant/ask', {
  method: 'POST',
  body: JSON.stringify({ projectId, question })
});
