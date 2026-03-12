export function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-surface-3 rounded-lg p-2.5 my-1.5 overflow-x-auto text-[11px] font-mono text-white/80"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-surface-3 px-1 py-0.5 rounded text-[11px] font-mono text-accent-blue">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white/90">$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" data-external-link class="text-accent-blue hover:underline cursor-pointer">$1</a>')
    .replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" data-external-link class="text-accent-blue hover:underline cursor-pointer">$2</a>')
    .replace(/^\- (.+)$/gm, '<div class="flex gap-1.5 ml-1"><span class="text-muted shrink-0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="ml-1">$&</div>')
    .replace(/\n/g, '<br/>')
}
