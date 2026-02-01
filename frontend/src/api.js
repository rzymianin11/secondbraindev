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
