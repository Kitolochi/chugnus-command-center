import { describe, expect, it } from 'vitest'
import { extractResources, mergeResources, toolResources, projectResources } from './conversationContext'

describe('conversation resource tracking', () => {
  it('finds links, quoted Windows paths with spaces and relative source references', () => {
    const resources = extractResources('See [preview](http://localhost:5173/editor). Edit `C:\\My Project\\src\\app.tsx` and src/styles.css:42. Also package.json')
    expect(resources).toEqual(expect.arrayContaining([
      { kind: 'site', value: 'http://localhost:5173/editor', evidence: 'mentioned' },
      { kind: 'file', value: 'C:/My Project/src/app.tsx', evidence: 'mentioned' },
      { kind: 'file', value: 'src/styles.css', evidence: 'mentioned' },
      { kind: 'file', value: 'package.json', evidence: 'mentioned' },
    ]))
  })
  it('tracks structured tool inputs before truncation and rejects non-web links', () => {
    expect(toolResources({ description: 'x'.repeat(1000), file_path: 'C:\\My Project\\README.md', nested: { url: 'https://example.com/work' } })).toHaveLength(2)
    expect(mergeResources([{ kind: 'site', value: 'javascript:alert(1)', evidence: 'mentioned' }])).toEqual([])
  })
  it('deduplicates Windows paths while upgrading evidence and preserving URL case', () => {
    expect(mergeResources(
      [{ kind: 'file', value: 'C:\\Demo\\App.tsx', evidence: 'mentioned' }],
      [{ kind: 'file', value: 'c:/demo/app.tsx', evidence: 'changed' }],
    )).toEqual([{ kind: 'file', value: 'c:/demo/app.tsx', evidence: 'changed' }])
    expect(extractResources('https://example.com/A https://example.com/a')).toHaveLength(2)
  })
  it('combines relative and absolute references to the same project file', () => {
    expect(projectResources([
      { kind: 'file', value: './src/../src/app.tsx', evidence: 'mentioned' },
      { kind: 'file', value: 'C:/demo/src/app.tsx', evidence: 'changed' },
    ], 'C:\\demo')).toEqual([{ kind: 'file', value: 'C:/demo/src/app.tsx', evidence: 'changed' }])
  })
})
