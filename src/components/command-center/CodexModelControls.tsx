import type { useCodexModelSelection } from '../../hooks/useCodexModelSelection'

export type ModelSelection = ReturnType<typeof useCodexModelSelection>

export function CodexModelSelect({
  selection,
  model,
  onChange,
  className,
  disabled,
}: {
  selection: ModelSelection
  model: string
  onChange: (value: string) => void
  className: string
  disabled?: boolean
}) {
  return (
    <select
      aria-label="Codex model"
      value={model}
      onChange={(event) => onChange(event.target.value)}
      className={className}
      disabled={disabled || !selection.data}
    >
      <option value="">
        {selection.loading
          ? 'Loading models...'
          : selection.data
            ? `Default (${selection.data.defaultModel})`
            : 'Models unavailable'}
      </option>
      {model && !selection.data?.models.some((item) => item.model === model) && (
        <option value={model}>{model} (unavailable)</option>
      )}
      {selection.data?.models.map((item) => (
        <option key={item.model} value={item.model} title={item.description}>
          {item.displayName}
        </option>
      ))}
    </select>
  )
}

export function CodexEffortSelect({
  selection,
  effort,
  onChange,
  className,
  disabled,
}: {
  selection: ModelSelection
  effort: string
  onChange: (value: string) => void
  className: string
  disabled?: boolean
}) {
  return (
    <select
      aria-label="Codex reasoning effort"
      value={effort}
      onChange={(event) => onChange(event.target.value)}
      className={className}
      disabled={disabled || !selection.definition}
    >
      <option value="">{selection.defaultEffort ? `Default (${selection.defaultEffort})` : 'Default'}</option>
      {effort && !selection.definition?.efforts.some((item) => item.value === effort) && (
        <option value={effort} disabled>
          {effort} (unsupported)
        </option>
      )}
      {selection.definition?.efforts.map((item) => (
        <option key={item.value} value={item.value} title={item.description}>
          {item.value.charAt(0).toUpperCase() + item.value.slice(1)}
        </option>
      ))}
    </select>
  )
}
