import { useCodexStore } from '../../store/codexStore'
import { codexQueueItem } from '../../lib/codexQueue'
import type { CodexSession } from '../../types/codex'
import FocusCard from './FocusCard'
import CodexComposer from './CodexComposer'
import CodexMemory from './CodexMemory'

export default function CodexTaskCard({ session }: { session: CodexSession }) {
  const archive = useCodexStore((s) => s.archive)
  return (
    <FocusCard
      item={codexQueueItem(session)}
      adapter={{
        park: (id) => {
          void archive(id, true, 'parked')
        },
        dismiss: (id) => {
          void archive(id, true, 'completed')
        },
        kill: (id) => {
          void archive(id, true, 'killed')
        },
        usage: `${(session.tokensIn + session.tokensOut).toLocaleString()} tokens`,
        composer: <CodexComposer key={session.id} session={session} />,
        details: (
          <details className="mt-3 text-[10px] text-white/40">
            <summary className="cursor-pointer">Session details & memory</summary>
            <div className="space-y-2 mt-2">
              <p>
                {session.turns} turns · {session.tokensIn.toLocaleString()} input / {session.tokensOut.toLocaleString()}{' '}
                output tokens
              </p>
              <CodexMemory session={session} />
            </div>
          </details>
        ),
      }}
    />
  )
}
