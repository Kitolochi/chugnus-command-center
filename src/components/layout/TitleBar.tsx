export default function TitleBar() {
  return (
    <div className="drag-region bg-surface-1/85 backdrop-blur-lg px-4 py-2.5 flex items-center justify-between border-b border-white/[0.06] relative z-10">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center animate-breathe shadow-lg shadow-accent-blue/20">
          <span className="text-[10px] font-bold text-white font-accent">C</span>
        </div>
        <h1 className="text-xs font-accent font-semibold tracking-widest uppercase">
          <span className="gradient-text">Chugnus Command Center</span>
        </h1>
      </div>
      <div className="flex gap-1.5 no-drag items-center">
        <button
          onClick={() => window.electronAPI.minimizeWindow()}
          className="w-6 h-6 rounded-md hover:bg-white/[0.1] flex items-center justify-center text-white/30 hover:text-white/60 transition-all duration-200 hover:scale-110 active:scale-90"
        >
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 10 1"><rect width="10" height="1" /></svg>
        </button>
        <button
          onClick={() => window.electronAPI.closeWindow()}
          className="w-6 h-6 rounded-md hover:bg-accent-red/20 flex items-center justify-center text-white/30 hover:text-accent-red transition-all duration-200 hover:scale-110 active:scale-90"
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
