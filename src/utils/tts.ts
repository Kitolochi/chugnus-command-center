/** Strip markdown formatting for natural speech output */
export function stripMarkdownForSpeech(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' code block omitted ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic markers
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove links — keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Speak text via the Web Speech API, returns the utterance for control */
export function speakText(
  text: string,
  onEnd?: () => void,
  onError?: (err: string) => void,
  rate?: number
): SpeechSynthesisUtterance {
  const cleaned = stripMarkdownForSpeech(text)
  const utterance = new SpeechSynthesisUtterance(cleaned)
  utterance.rate = rate ?? 1.5
  utterance.pitch = 1.0
  if (onEnd) utterance.onend = () => onEnd()
  if (onError) utterance.onerror = (e) => onError(e.error)
  speechSynthesis.speak(utterance)
  return utterance
}

/** Cancel any active speech */
export function cancelSpeech(): void {
  speechSynthesis.cancel()
}
