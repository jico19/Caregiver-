import { api } from '../services/api';

export async function downloadDocument(docId, token) {
  try {
    const res = await api.get(`/documents/${docId}/download-url`, token);
    if (res?.download_url) {
      window.open(res.download_url, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    alert(err?.detail || 'Could not retrieve download link. Please refresh.');
  }
}
