import { useEffect, useState } from 'react'
import { Send, MessageCircle, ArrowUpRight, ArrowDownLeft, RefreshCw, Sparkles, Check, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMessages, sendMessage, suggestReply } from '../api/client'
import type { Message } from '../types'

interface Suggestion { tone: string; text: string }
interface Conversation { phone: string; messages: Message[]; lastMsg: Message }

const TONE_LABEL: Record<string, string> = {
  profesional: 'Profesional',
  cercano:     'Cercano',
  cierre:      'Cierre de venta',
}
const TONE_COLOR: Record<string, string> = {
  profesional: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  cercano:     'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  cierre:      'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
}

function fmt(d: string) {
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtShort(d: string) {
  const now = new Date()
  const date = new Date(d)
  const diffH = (now.getTime() - date.getTime()) / 3600000
  if (diffH < 24) return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function WhatsApp() {
  const [messages, setMessages]         = useState<Message[]>([])
  const [phone, setPhone]               = useState('')
  const [text, setText]                 = useState('')
  const [sending, setSending]           = useState(false)
  const [loading, setLoading]           = useState(false)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([])
  const [loadingSugg, setLoadingSugg]   = useState(false)
  const [usedSugg, setUsedSugg]         = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try { setMessages(await getMessages()) }
    catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Group messages by phone, sorted by latest message
  const conversations: Conversation[] = Object.values(
    messages.reduce((acc: Record<string, Conversation>, m) => {
      if (!acc[m.phone]) acc[m.phone] = { phone: m.phone, messages: [], lastMsg: m }
      acc[m.phone].messages.push(m)
      if (new Date(m.created_at) > new Date(acc[m.phone].lastMsg.created_at))
        acc[m.phone].lastMsg = m
      return acc
    }, {})
  ).sort((a, b) => new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime())

  const activeConv = selectedPhone
    ? conversations.find(c => c.phone === selectedPhone)
    : null

  const handleSend = async () => {
    const target = phone.trim() || selectedPhone || ''
    if (!target || !text.trim()) return toast.error('Completá teléfono y mensaje')
    setSending(true)
    try {
      await sendMessage(target, text)
      toast.success('Mensaje enviado')
      setText('')
      setUsedSugg(null)
      load()
    } catch { toast.error('Error al enviar mensaje') }
    finally { setSending(false) }
  }

  const handleGetSuggestions = async (targetPhone: string) => {
    if (!targetPhone) return toast.error('Seleccioná una conversación primero')
    setLoadingSugg(true)
    setSuggestions([])
    setUsedSugg(null)
    try {
      const res = await suggestReply(targetPhone)
      setSuggestions(res.suggestions || [])
      if (!res.suggestions?.length) toast.error('Sin sugerencias disponibles')
    } catch { toast.error('Error al generar sugerencias') }
    finally { setLoadingSugg(false) }
  }

  const useSuggestion = (s: Suggestion, idx: number) => {
    setText(s.text)
    setUsedSugg(idx)
    if (selectedPhone) setPhone(selectedPhone)
  }

  return (
    <div className="page">
      <div>
        <h1 className="page-title">WhatsApp Business</h1>
        <p className="text-sm text-slate-500 mt-1">
          {conversations.length} conversaciones · {messages.filter(m => m.direction !== 'out').length} recibidos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Conversation list ── */}
        <div className="lg:col-span-1 card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <p className="text-sm font-semibold text-slate-700">Conversaciones</p>
            <button onClick={load} disabled={loading} className="btn-ghost text-xs px-2 py-1.5">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="py-16 text-center">
              <MessageCircle size={26} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">Sin conversaciones aún</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 overflow-y-auto max-h-[480px]">
              {conversations.map(conv => {
                const isActive = selectedPhone === conv.phone
                const inbound = conv.messages.filter(m => m.direction !== 'out').length
                return (
                  <button
                    key={conv.phone}
                    onClick={() => {
                      setSelectedPhone(conv.phone)
                      setPhone(conv.phone)
                      setSuggestions([])
                      setUsedSugg(null)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive ? 'bg-brand-pale' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isActive ? 'bg-brand-accent text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {conv.phone.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{conv.phone}</p>
                      <p className="text-xs text-slate-400 truncate">{conv.lastMsg.content || '—'}</p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-slate-400">{fmtShort(conv.lastMsg.created_at)}</span>
                      {inbound > 0 && (
                        <span className="text-[10px] font-bold bg-brand-accent text-white rounded-full w-4 h-4 flex items-center justify-center">
                          {inbound > 9 ? '9+' : inbound}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right panel: messages + AI + send ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Message thread */}
          {activeConv ? (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 bg-slate-50/40">
                <div className="w-7 h-7 rounded-full bg-brand-accent/10 flex items-center justify-center text-xs font-bold text-brand-accent">
                  {activeConv.phone.slice(-2)}
                </div>
                <p className="text-sm font-semibold text-slate-700">{activeConv.phone}</p>
                <a
                  href={`https://indumentariasegura.kommo.com/leads/?query=${activeConv.phone}`}
                  target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs text-brand-accent hover:underline"
                >
                  Ver en Kommo <ChevronRight size={11} />
                </a>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto max-h-56">
                {activeConv.messages
                  .slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                        msg.direction === 'out'
                          ? 'bg-brand-accent text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                      }`}>
                        <p className="leading-snug">{msg.content || <em className="opacity-50">mensaje sin texto</em>}</p>
                        <p className={`text-[10px] mt-1 ${msg.direction === 'out' ? 'text-white/60' : 'text-slate-400'}`}>
                          {fmt(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          ) : (
            <div className="card py-12 text-center">
              <MessageCircle size={28} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">Seleccioná una conversación</p>
            </div>
          )}

          {/* ── AI Suggestions panel ── */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Sparkles size={12} className="text-violet-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Sugerencias IA</p>
                {suggestions.length > 0 && (
                  <span className="text-[10px] text-slate-400">— clic para usar</span>
                )}
              </div>
              <button
                onClick={() => handleGetSuggestions(selectedPhone || phone)}
                disabled={loadingSugg || (!selectedPhone && !phone)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-all disabled:opacity-40"
              >
                <Sparkles size={11} className={loadingSugg ? 'animate-pulse' : ''} />
                {loadingSugg ? 'Generando...' : 'Generar'}
              </button>
            </div>

            {suggestions.length > 0 ? (
              <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => useSuggestion(s, i)}
                    className={`flex items-start gap-2.5 text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      usedSugg === i
                        ? 'ring-2 ring-offset-1 ring-violet-400 ' + (TONE_COLOR[s.tone] || 'bg-slate-50 text-slate-700 border-slate-200')
                        : TONE_COLOR[s.tone] || 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex flex-col shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide opacity-70 leading-none">
                        {TONE_LABEL[s.tone] || s.tone}
                      </span>
                    </div>
                    <p className="flex-1 leading-snug">{s.text}</p>
                    {usedSugg === i && <Check size={13} className="shrink-0 mt-0.5" />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {loadingSugg
                  ? 'Claude está analizando la conversación...'
                  : 'Seleccioná una conversación y presioná Generar para ver sugerencias de respuesta.'}
              </p>
            )}
          </div>

          {/* ── Send form ── */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-teal-100 flex items-center justify-center">
                <Send size={12} className="text-teal-600" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Enviar mensaje</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="sm:w-48 shrink-0">
                <label className="label">Teléfono</label>
                <input
                  className="input"
                  placeholder="+5491141940799"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="label">Mensaje</label>
                <input
                  className="input"
                  placeholder="Escribí el mensaje..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
              </div>
              <button onClick={handleSend} disabled={sending} className="btn-primary shrink-0">
                <Send size={14} />
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
