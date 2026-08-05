import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import api from '../api/client'

interface Message { role: 'user' | 'assistant'; content: string }

const WELCOME: Message = {
  role: 'assistant',
  content: '¡Hola! Soy tu asistente médico con IA. Analicé todos los estudios cargados y puedo ayudarte a entenderlos, compararlos con casos similares y buscar información sobre tratamientos. ¿En qué te puedo ayudar hoy?',
}

const SUGGESTIONS = [
  '¿Qué muestran los últimos estudios?',
  '¿Qué tratamientos existen para cáncer de ovario con recaídas?',
  '¿Cómo comparar los resultados de laboratorio con estudios anteriores?',
  '¿Qué preguntas debería hacerle al oncólogo?',
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load history from server on mount
  useEffect(() => {
    api.get('/chat/history').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        setMessages(res.data)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const clearHistory = async () => {
    if (!confirm('¿Borrar todo el historial de conversación?')) return
    await api.delete('/chat/history').catch(() => {})
    setMessages([WELCOME])
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)
    try {
      const res = await api.post('/chat', { messages: updated })
      // Backend saves history automatically on every /chat call
      setMessages([...updated, { role: 'assistant' as const, content: res.data.reply }])
    } catch {
      setMessages([...updated, { role: 'assistant', content: 'Error al conectar con la IA. Intentá de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); send(input) }

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Clear history button */}
        {messages.length > 1 && (
          <div className="flex justify-center">
            <button
              onClick={clearHistory}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors px-3 py-1 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={11} /> Borrar historial
            </button>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={16} className="text-blue-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              ) : (
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <p className="font-bold text-slate-800 text-base mt-3 mb-1 first:mt-0">{children}</p>,
                    h3: ({ children }) => <p className="font-semibold text-slate-700 mt-2 mb-0.5">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 pl-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 pl-1">{children}</ol>,
                    li: ({ children }) => <li className="text-slate-700">{children}</li>,
                    hr: () => <hr className="my-3 border-slate-100" />,
                    blockquote: ({ children }) => (
                      <div className="border-l-2 border-blue-200 pl-3 text-slate-500 italic my-2">{children}</div>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-2">
                        <table className="text-xs border-collapse w-full">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-left">{children}</th>,
                    td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User size={16} className="text-slate-500" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-blue-600" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <Loader2 size={16} className="animate-spin text-blue-400" />
            </div>
          </div>
        )}

        {messages.length === 1 && !loading && (
          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-2 text-center">Sugerencias</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all shadow-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Preguntá sobre los estudios, tratamientos, síntomas..."
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-11 h-11 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all shadow-sm"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-2">IA de apoyo informativo — consultá siempre con tu equipo médico</p>
      </div>
    </div>
  )
}
