import { X } from 'lucide-react'

export default function CodexAttachments({ files, onRemove }: { files: string[]; onRemove: (file: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file) => {
        const isImage = /\.(png|jpe?g|gif|webp)$/i.test(file)
        const normalized = file.replace(/\\/g, '/')
        const source = new URL('file:///')
        source.pathname = normalized.startsWith('/') ? normalized : `/${normalized}`
        return (
          <div
            key={file}
            title={file}
            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-surface-2 p-1.5"
          >
            {isImage && <img src={source.href} alt="Attached image" className="h-14 w-14 rounded object-cover" />}
            <span className="max-w-[120px] truncate text-[10px] text-white/60">{file.split(/[/\\]/).pop()}</span>
            <button
              type="button"
              aria-label={`Remove ${file}`}
              onClick={() => onRemove(file)}
              className="text-white/30 hover:text-accent-red"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
