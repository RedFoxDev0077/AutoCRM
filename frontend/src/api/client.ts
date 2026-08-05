import axios from 'axios'
import type { DashboardStats, Lead, Listing, Message } from '../types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('autocrm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    // Don't redirect when the login endpoint itself returns 401
    const isLoginCall = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem('autocrm_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const getDashboardStats = (): Promise<DashboardStats> =>
  api.get('/dashboard/stats').then(r => r.data)

export const getLeads = (page = 1, status?: string): Promise<{ leads: Lead[]; total: number }> =>
  api.get('/leads', { params: { page, limit: 20, status } }).then(r => r.data)

export const searchLeads = (query: string, location: string, radius_km: number) =>
  api.post('/leads/search', { query, location, radius_km }).then(r => r.data)

export const updateLeadStatus = (id: number, status: string): Promise<Lead> =>
  api.put(`/leads/${id}/status`, { status }).then(r => r.data)

export const contactLead = (id: number) =>
  api.post(`/leads/${id}/contact`).then(r => r.data)

export const getListings = (): Promise<Listing[]> =>
  api.get('/ml/listings').then(r => r.data)

export const syncListings = () =>
  api.post('/ml/listings/sync').then(r => r.data)

export const optimizeListing = (id: number): Promise<Listing> =>
  api.post(`/ml/listings/${id}/optimize`).then(r => r.data)

export const approveListing = (id: number): Promise<Listing> =>
  api.put(`/ml/listings/${id}/approve`).then(r => r.data)

export const rejectListing = (id: number): Promise<Listing> =>
  api.put(`/ml/listings/${id}/reject`).then(r => r.data)

export const editListing = (
  id: number,
  data: { title: string; price: number; quantity: number; description?: string }
): Promise<Listing> =>
  api.put(`/ml/listings/${id}/edit`, { description: '', ...data }).then(r => r.data)

export const getMessages = (): Promise<Message[]> =>
  api.get('/whatsapp/messages').then(r => r.data)

export const sendMessage = (phone: string, message: string) =>
  api.post('/whatsapp/send', { phone, message }).then(r => r.data)

export const getKommoStatus = () =>
  api.get('/kommo/status').then(r => r.data)

export const getWhatsappStatus = () =>
  api.get('/whatsapp/status').then(r => r.data)

export const getGoogleStatus = () =>
  api.get('/google/status').then(r => r.data)

export const getMLStatus = () =>
  api.get('/ml/status').then(r => r.data)

export const getClaudeStatus = () =>
  api.get('/claude/status').then(r => r.data)

export const getMetaStatus = () =>
  api.get('/social/meta-status').then(r => r.data)

export const getMLQuestions = (status = 'UNANSWERED') =>
  api.get('/ml/questions', { params: { status } }).then(r => r.data)

export const answerMLQuestion = (questionId: number, text: string) =>
  api.post(`/ml/questions/${questionId}/answer`, { text }).then(r => r.data)

export const generateListing = (title: string, competitorUrl: string) =>
  api.post('/ml/listings/generate', { title, competitor_url: competitorUrl }).then(r => r.data)

export const publishListing = (data: {
  title: string; description: string; price: number
  quantity: number; condition: string; category_id: string
}) => api.post('/ml/listings/publish', data).then(r => r.data)

export const getMLDailySales = () =>
  api.get('/ml/sales/daily').then(r => r.data)

export const syncMLSales = () =>
  api.post('/ml/sales/sync').then(r => r.data)

export const suggestReply = (phone: string) =>
  api.post('/whatsapp/suggest-reply', { phone }).then(r => r.data)

export const getHotLeads = () =>
  api.get('/kommo/hot-leads').then(r => r.data)

export const saveMetaConfig = (data: { access_token: string; page_id: string; ig_account_id: string }) =>
  api.post('/social/meta-config', data).then(r => r.data)

export const getBusinessContext = (): Promise<{ context: string }> =>
  api.get('/social/business-context').then(r => r.data)

export const saveBusinessContext = (context: string) =>
  api.post('/social/business-context', { context }).then(r => r.data)

export const getMLBudgetAnalysis = () =>
  api.get('/ml/budget-analysis').then(r => r.data)

export const compareMLListing = (listing_id: number, competitor_url: string) =>
  api.post('/ml/listings/compare', { listing_id, competitor_url }).then(r => r.data)

export const subscribePush = (sub: { endpoint: string; p256dh: string; auth: string }) =>
  api.post('/push/subscribe', sub).then(r => r.data)

export const testPush = () =>
  api.post('/push/test').then(r => r.data)

export default api
