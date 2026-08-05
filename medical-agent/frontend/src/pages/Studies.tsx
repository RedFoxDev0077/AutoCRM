import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, Image, Trash2, Download, RefreshCw, Plus, X, Loader2, FolderOpen } from 'lucide-react'
import api from '../api/client'

interface Study { name: string; size: number; modified: number }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || ''))
    return <Image size={16} className="text-purple-500" />
  return <FileText size={16} className="text-blue-500" />
}

export default function Studies() {
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/studies')
      setStudies(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      await api.post('/studies/upload', form)
    }
    e.target.value = ''
    load()
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    await api.delete(`/studies/${encodeURIComponent(name)}`)
    load()
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      await api.post('/portal/sync')
      setSyncMsg('Sincronización iniciada. Puede tardar unos minutos...')
      setTimeout(load, 8000)
    } catch {
      setSyncMsg('Error al iniciar sincronización')
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return
    setSavingNote(true)
    const form = new FormData()
    form.append('title', noteTitle)
    form.append('content', noteContent)
    await api.post('/studies/note', form)
    setSavingNote(false)
    setNoteTitle('')
    setNoteContent('')
    setShowNote(false)
    load()
  }

  return (
    <div className="h-full overflow-y-auto p-4 max-w-3xl mx-auto">
      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
        >
          <Upload size={15} /> Subir archivo
        </button>
        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt" onChange={handleUpload} className="hidden" />

        <button
          onClick={() => setShowNote(true)}
          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 transition-all shadow-sm"
        >
          <Plus size={15} /> Agregar nota
        </button>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 transition-all shadow-sm disabled:opacity-60"
        >
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          Sincronizar portal Fleming
        </button>

        <button onClick={load} className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
          <RefreshCw size={15} />
        </button>
      </div>

      {syncMsg && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-xl">{syncMsg}</div>
      )}

      {/* Add note modal */}
      {showNote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Agregar nota / información</h3>
              <button onClick={() => setShowNote(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <input
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
              placeholder="Título (ej: Síntomas semana del 20/05)"
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Escribí aquí síntomas, observaciones, medicación, dosis, fechas de tratamiento..."
              rows={6}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNote(false)} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">Cancelar</button>
              <button
                onClick={handleSaveNote}
                disabled={savingNote || !noteTitle.trim() || !noteContent.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                {savingNote ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Studies list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-400" /></div>
      ) : studies.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hay estudios cargados</p>
          <p className="text-sm mt-1">Subí archivos o sincronizá el portal Fleming</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">{studies.length} archivo{studies.length !== 1 ? 's' : ''}</p>
          {studies.map(s => (
            <div key={s.name} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm hover:border-blue-200 transition-all">
              {fileIcon(s.name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{s.name}</p>
                <p className="text-xs text-slate-400">{formatSize(s.size)} · {new Date(s.modified * 1000).toLocaleDateString('es-AR')}</p>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`/api/studies/download/${encodeURIComponent(s.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                  title="Descargar"
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => handleDelete(s.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
