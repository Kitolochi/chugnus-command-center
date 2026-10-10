import { describe, expect, it } from 'vitest'
import { describeActivityLine, describeTool, firstSentence } from './describeActivity'

describe('describeTool', () => {
  it('uses the description Claude writes for shell commands', () => {
    expect(describeTool('Bash', { command: 'npm run build', description: 'Build the app' })).toBe('Build the app')
    expect(describeTool('PowerShell', { command: 'ls' })).toBe('Running a command')
  })

  it('names the file for reads and edits', () => {
    expect(describeTool('Edit', { file_path: 'C:\\repo\\src\\LiveView.tsx' })).toBe('Editing LiveView.tsx')
    expect(describeTool('Read', { file_path: '/repo/README.md' })).toBe('Reading README.md')
  })

  it('groups tool families into plain phrases', () => {
    expect(describeTool('mcp__chrome-devtools__evaluate_script', {})).toBe('Using the browser')
    expect(describeTool('mcp__supabase__execute_sql', {})).toBe('Querying the database')
    expect(describeTool('mcp__blender__execute_blender_code', {})).toBe('Working in Blender')
    expect(describeTool('mcp__figma__get_file', {})).toBe('Using figma')
    expect(describeTool('TodoWrite', { todos: [] })).toBe('Updating its plan')
  })

  it('keeps phrases short', () => {
    expect(describeTool('Bash', { description: 'x'.repeat(200) }).length).toBeLessThanOrEqual(90)
  })
})

describe('firstSentence', () => {
  it('takes the first sentence and drops markdown', () => {
    expect(firstSentence('**Done.** The render is in VLC. Next I check the grade.')).toBe('Done.')
    expect(firstSentence('I rebuilt the app and opened it. It has two new things.')).toBe(
      'I rebuilt the app and opened it.'
    )
    expect(firstSentence('- first item\n- second item')).toBe('first item second item')
  })
})

describe('describeActivityLine', () => {
  it('reads a Claude queue activity line', () => {
    expect(describeActivityLine('Edit: {"file_path":"C:\\\\a\\\\b.ts","old_string":"x"}')).toBe('Editing b.ts')
    expect(describeActivityLine('Bash: {"command":"npm test","descr')).toBe('Running a command')
  })

  it('keeps plain Codex activity text', () => {
    expect(describeActivityLine('Ran tests: 12 passed')).toBe('Ran tests: 12 passed')
  })
})
