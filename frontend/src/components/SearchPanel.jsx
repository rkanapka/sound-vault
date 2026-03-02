import { useState } from 'react'
import { Search, Square, Download, User, Music, Loader2 } from 'lucide-react'
import { downloadFile } from '../api'

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function basename(path) {
  return path.split(/[/\\]/).pop()
}

function ResultGroup({ username, files }) {
  const [states, setStates] = useState({})

  const handleDownload = async (file) => {
    setStates((s) => ({ ...s, [file.filename]: 'loading' }))
    try {
      await downloadFile(username, file.filename, file.size)
      setStates((s) => ({ ...s, [file.filename]: 'done' }))
    } catch {
      setStates((s) => ({ ...s, [file.filename]: 'error' }))
    }
  }

  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500">
        <User size={11} className="flex-none" />
        <span className="font-medium truncate">{username}</span>
        <span className="text-slate-700 flex-none">·</span>
        <span className="flex-none text-slate-600">{files.length}</span>
      </div>
      <div>
        {files.map((file) => {
          const st = states[file.filename]
          const name = basename(file.filename)
          const ext = name.split('.').pop().toUpperCase()
          return (
            <div
              key={file.filename}
              className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800/60 rounded mx-1 group transition-colors"
            >
              <Music
                size={12}
                className="text-slate-600 flex-none group-hover:text-emerald-500/70 transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate leading-snug">{name}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="text-emerald-600/80 font-medium">{ext}</span>
                  {file.size ? ` · ${fmtSize(file.size)}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDownload(file)}
                disabled={!!st}
                className={`
                  flex-none flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all
                  ${
                    st === 'done'
                      ? 'bg-emerald-900/30 text-emerald-500 cursor-default'
                      : st === 'error'
                        ? 'bg-red-900/30 text-red-400 cursor-default'
                        : st === 'loading'
                          ? 'bg-slate-700/60 text-slate-500 cursor-default'
                          : 'bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100'
                  }
                `}
              >
                {st === 'loading' ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : st === 'done' ? (
                  '✓ Queued'
                ) : st === 'error' ? (
                  '✗ Error'
                ) : (
                  <Download size={11} />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SearchPanel({ search, embedded = false }) {
  const { query, setQuery, results, searching, startSearch, stopSearch } = search
  const usernames = Object.keys(results)
  const totalFiles = Object.values(results).reduce((n, f) => n + f.length, 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (searching) stopSearch()
    else startSearch(query)
  }

  return (
    <section className={embedded ? 'flex flex-col flex-1 min-h-0 w-full' : 'flex flex-col w-72 sm:w-80 xl:w-96 flex-none min-h-0'}>
      {/* Header */}
      <div className="flex-none p-3 border-b border-slate-800">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2.5">
          Soulseek
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for music…"
            className="flex-1 bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 transition-colors"
          />
          <button
            type="submit"
            className={`
              flex-none flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all
              ${
                searching
                  ? 'bg-red-900/40 hover:bg-red-800/50 text-red-400 border border-red-800/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }
            `}
          >
            {searching ? <Square size={13} /> : <Search size={13} />}
          </button>
        </form>

        {(searching || totalFiles > 0) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            {searching && <Loader2 size={11} className="animate-spin text-emerald-500 flex-none" />}
            {searching && <span className="text-emerald-600/80">Searching…</span>}
            {totalFiles > 0 && (
              <span>
                {totalFiles} file{totalFiles !== 1 ? 's' : ''} from {usernames.length} user
                {usernames.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-1">
        {usernames.length === 0 && !searching && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-700 py-10">
            <Music size={28} strokeWidth={1.5} />
            <p className="text-sm">Search to find music</p>
          </div>
        )}
        {usernames.map((username) => (
          <ResultGroup key={username} username={username} files={results[username]} />
        ))}
      </div>
    </section>
  )
}
