function parseTextContent(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []
  if (text.trim().startsWith('[') || text.trim().startsWith('{')) return parseJSON(text)
  if (lines.some(l => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))) return parseKeyValue(lines, '=')
  if (lines.some(l => /^[A-Za-z_][A-Za-z0-9_]*:\s/.test(l))) return parseKeyValue(lines, ':')
  if (lines.length >= 2 && /\t|  +/.test(lines[0])) return parseTable(lines)
  return parseLineByLine(lines)
}

function parseJSON(text) {
  try {
    const data = JSON.parse(text)
    const items = Array.isArray(data) ? data : [data]
    return items.map(item => ({
      type: 'apikey',
      title: String(item.name || item.title || item.service || '未命名'),
      username: String(item.username || item.user || ''),
      password: String(item.key || item.api_key || item.token || item.secret || item.password || ''),
      url: String(item.url || item.endpoint || ''),
      notes: String(item.notes || item.description || ''),
    }))
  } catch { return [] }
}

function parseKeyValue(lines, delimiter) {
  return lines.map(line => {
    const idx = line.indexOf(delimiter)
    if (idx === -1) return null
    const key = line.substring(0, idx).trim()
    const value = line.substring(idx + 1).trim()
    return { type: /api|key|token|secret/i.test(key) ? 'apikey' : 'password',
      title: key, username: '', password: value, url: '', notes: '' }
  }).filter(Boolean)
}

function parseTable(lines) {
  const delimiter = lines[0].includes('\t') ? '\t' : /  +/
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase())
  const entries = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim())
    const entry = { type: 'apikey', title: '', username: '', password: '', url: '', notes: '' }
    headers.forEach((header, idx) => {
      const val = values[idx] || ''
      if (/name|title|service/i.test(header)) entry.title = val
      else if (/user|email/i.test(header)) entry.username = val
      else if (/key|pass|secret|token/i.test(header)) entry.password = val
      else if (/url|endpoint/i.test(header)) entry.url = val
      else if (/note|memo/i.test(header)) entry.notes = val
      else if (!entry.title) entry.title = val
    })
    if (entry.title || entry.password) entries.push(entry)
  }
  return entries
}

function parseLineByLine(lines) {
  return lines.map(line => {
    const t = line.trim()
    if (!t) return null
    return { type: 'apikey', title: t.substring(0, 30) + (t.length > 30 ? '...' : ''),
      username: '', password: t, url: '', notes: '' }
  }).filter(Boolean)
}

module.exports = { parseTextContent }
