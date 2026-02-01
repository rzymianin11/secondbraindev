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
export const bulkUpdateTasks = (ids, updates) => request('/tasks/bulk/update', {
  method: 'PATCH',
  body: JSON.stringify({ ids, ...updates })
});
