import { create } from "zustand";
import api from "../lib/api.js";

const extractError = (error) => error.response?.data?.message || error.message || "Request failed";

export const useAppStore = create((set, get) => ({
  loading: {},
  users: [],
  clients: [],
  invoices: [],
  templates: [],
  payments: [],
  logs: [],
  reports: null,
  settings: null,

  setLoading(key, value) {
    set((state) => ({ loading: { ...state.loading, [key]: value } }));
  },

  async request(key, action) {
    get().setLoading(key, true);
    try {
      return await action();
    } catch (error) {
      throw new Error(extractError(error));
    } finally {
      get().setLoading(key, false);
    }
  },

  async fetchUsers() {
    return get().request("users", async () => {
      const { data } = await api.get("/users");
      set({ users: data });
      return data;
    });
  },
  async saveUser(payload, id) {
    return get().request("users", async () => {
      const { data } = id ? await api.patch(`/users/${id}`, payload) : await api.post("/users", payload);
      await get().fetchUsers();
      return data;
    });
  },
  async deleteUser(id) {
    return get().request("users", async () => {
      await api.delete(`/users/${id}`);
      set((state) => ({ users: state.users.filter((user) => user._id !== id) }));
    });
  },
  async deleteManager(id) {
    return get().request("users", async () => {
      await api.delete(`/managers/${id}`);
      set((state) => ({ users: state.users.filter((user) => user._id !== id) }));
    });
  },

  async fetchClients() {
    return get().request("clients", async () => {
      const { data } = await api.get("/clients");
      set({ clients: data });
      return data;
    });
  },
  async saveClient(payload, id) {
    return get().request("clients", async () => {
      const { data } = id ? await api.patch(`/clients/${id}`, payload) : await api.post("/clients", payload);
      await get().fetchClients();
      return data;
    });
  },
  async deleteClient(id) {
    return get().request("clients", async () => {
      await api.delete(`/clients/${id}`);
      set((state) => ({ clients: state.clients.filter((client) => client._id !== id) }));
    });
  },

  async fetchInvoices(params = {}) {
    return get().request("invoices", async () => {
      const { data } = await api.get("/invoices", { params });
      set({ invoices: data });
      return data;
    });
  },
  async fetchInvoice(id) {
    return get().request("invoice", async () => {
      const { data } = await api.get(`/invoices/${id}`);
      return data;
    });
  },
  async saveInvoice(payload, id) {
    return get().request("invoiceSave", async () => {
      const { _id, createdAt, updatedAt, __v, createdBy, ...cleanPayload } = payload;
      const { data } = id ? await api.patch(`/invoices/${id}`, cleanPayload) : await api.post("/invoices", cleanPayload);
      await Promise.all([get().fetchInvoices(), get().fetchReports()]);
      return data;
    });
  },
  async deleteInvoice(id) {
    return get().request("invoices", async () => {
      await api.delete(`/invoices/${id}`);
      set((state) => ({ invoices: state.invoices.filter((invoice) => invoice._id !== id) }));
      await get().fetchReports();
    });
  },
  async duplicateInvoice(id) {
    return get().request("invoices", async () => {
      const { data } = await api.post(`/invoices/${id}/duplicate`);
      await Promise.all([get().fetchInvoices(), get().fetchReports()]);
      return data;
    });
  },
  async emailInvoice(id, to) {
    return get().request("emailInvoice", async () => {
      const { data } = await api.post(`/invoices/${id}/send-email`, { to });
      await get().fetchInvoices();
      return data;
    });
  },

  async fetchTemplates() {
    return get().request("templates", async () => {
      const { data } = await api.get("/templates");
      set({ templates: data });
      return data;
    });
  },
  async saveTemplate(payload, id) {
    return get().request("templates", async () => {
      const { data } = id ? await api.patch(`/templates/${id}`, payload) : await api.post("/templates", payload);
      await get().fetchTemplates();
      return data;
    });
  },
  async deleteTemplate(id) {
    return get().request("templates", async () => {
      await api.delete(`/templates/${id}`);
      set((state) => ({ templates: state.templates.filter((template) => template._id !== id) }));
    });
  },

  async fetchPayments() {
    return get().request("payments", async () => {
      const { data } = await api.get("/payments");
      set({ payments: data });
      return data;
    });
  },
  async savePayment(payload) {
    return get().request("payments", async () => {
      const { data } = await api.post("/payments", payload);
      await Promise.all([get().fetchPayments(), get().fetchInvoices(), get().fetchReports()]);
      return data;
    });
  },

  async fetchReports() {
    return get().request("reports", async () => {
      const { data } = await api.get("/reports/overview");
      set({ reports: data });
      return data;
    });
  },

  async fetchLogs(params = {}) {
    return get().request("logs", async () => {
      const { data } = await api.get("/logs", { params });
      set({ logs: data });
      return data;
    });
  },

  async fetchSettings() {
    return get().request("settings", async () => {
      const { data } = await api.get("/settings");
      set({ settings: data });
      return data;
    });
  },
  async saveSettings(payload) {
    return get().request("settings", async () => {
      const { data } = await api.patch("/settings", payload);
      set({ settings: data });
      return data;
    });
  },

  async uploadFile(file) {
    return get().request("upload", async () => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/uploads", form, { headers: { "Content-Type": "multipart/form-data" } });
      return data;
    });
  }
}));
