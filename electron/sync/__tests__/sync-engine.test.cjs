const { mergeEntries } = require('../sync-engine.cjs')

describe('sync-engine.cjs', () => {
  describe('mergeEntries', () => {
    it('should add new remote entries', () => {
      const local = [{ id: '1', title: 'A', updated_at: '2024-01-01' }]
      const remote = [
        { id: '1', title: 'A', updated_at: '2024-01-01' },
        { id: '2', title: 'B', updated_at: '2024-01-02' },
      ]
      const { entries } = mergeEntries(local, remote)
      expect(entries.length).toBe(2)
    })

    it('should keep newer local version', () => {
      const local = [{ id: '1', title: 'A-local', updated_at: '2024-01-02' }]
      const remote = [{ id: '1', title: 'A-remote', updated_at: '2024-01-01' }]
      const { entries } = mergeEntries(local, remote)
      expect(entries[0].title).toBe('A-local')
    })

    it('should use newer remote version', () => {
      const local = [{ id: '1', title: 'A-local', updated_at: '2024-01-01' }]
      const remote = [{ id: '1', title: 'A-remote', updated_at: '2024-01-02' }]
      const { entries } = mergeEntries(local, remote)
      expect(entries[0].title).toBe('A-remote')
    })

    it('should handle empty arrays', () => {
      const { entries } = mergeEntries([], [])
      expect(entries.length).toBe(0)
    })

    it('should handle multiple entries', () => {
      const local = [
        { id: '1', title: 'A', updated_at: '2024-01-01' },
        { id: '2', title: 'B', updated_at: '2024-01-02' },
      ]
      const remote = [
        { id: '1', title: 'A-new', updated_at: '2024-01-03' },
        { id: '3', title: 'C', updated_at: '2024-01-01' },
      ]
      const { entries } = mergeEntries(local, remote)
      expect(entries.length).toBe(3)
      expect(entries.find(e => e.id === '1').title).toBe('A-new')
    })

    it('should keep local when timestamps are equal', () => {
      const local = [{ id: '1', title: 'A-local', updated_at: '2024-01-01' }]
      const remote = [{ id: '1', title: 'A-remote', updated_at: '2024-01-01' }]
      const { entries } = mergeEntries(local, remote)
      expect(entries[0].title).toBe('A-local')
    })
  })
})
