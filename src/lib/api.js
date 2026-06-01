import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true
});

api.interceptors.request.use((config) => {
  
  if (config.url && !config.url.startsWith('/api')) {
    config.url = '/api' + config.url;
  }

  const token = 
    localStorage.getItem("webcultivation_token") || 
    sessionStorage.getItem("webcultivation_token") || 
    localStorage.getItem("token") || 
    sessionStorage.getItem("token");
    
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;