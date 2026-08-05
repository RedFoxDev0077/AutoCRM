import { useState } from 'react'
import { MessageCircle, FolderOpen, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Chat from './Chat'
import Studies from './Studies'

type Tab = 'chat' | 'studies'

export default function Main() {
  const { logout } = useAuth()
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">IA</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Agente Médico</p>
            <p className="text-[10px] text-slate-400">Cáncer de ovario · IAF6612</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'chat' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <MessageCircle size={13} /> Chat
          </button>
          <button
            onClick={() => setTab('studies')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'studies' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <FolderOpen size={13} /> Estudios
          </button>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'chat' ? <Chat /> : <Studies />}
      </div>
    </div>
  )
}
