/**
 * API configuration for backend endpoints
 * Automatically uses localhost for development and production URL for deployed app
 */

// Check if we're in development (localhost or preview URL)
const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname.includes('.lovable.app');

// Use localhost:8000 for development, production URL for deployed app
export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:8000' 
  : 'https://chronoboard-backend.onrender.com';

export const API_ENDPOINTS = {
  // Document endpoints
  uploadDocument: (projectId: string) => `${API_BASE_URL}/api/projects/${projectId}/documents/`,
  generateDocumentSummary: (documentId: string) => `${API_BASE_URL}/api/documents/${documentId}/generate-summary`,
  
  // Event endpoints
  generateEventSummary: (eventId: string) => `${API_BASE_URL}/api/events/${eventId}/generate-summary`,
  
  // Chat endpoints
  sendTestMessage: `${API_BASE_URL}/api/chat/send-test`,
  
  // Health check
  health: `${API_BASE_URL}/health`,
};