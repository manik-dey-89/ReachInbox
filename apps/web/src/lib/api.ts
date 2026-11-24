import axios from 'axios';

// In the browser, always use relative /api/* paths so requests go through
// the Next.js rewrite proxy -> backend. This avoids CORS issues entirely.
// On the server (SSR), use the full backend URL.
const baseURL =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    : '';  // relative — browser uses Next.js rewrite /api/* -> backend

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
