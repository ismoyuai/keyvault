const Papa = require('papaparse')

function parseBrowserCSV(csvContent) {
  const result = Papa.parse(csvContent.trim(), {
    header: true, skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })
  const headers = result.meta.fields || []
  if (headers.includes('name') && headers.includes('url'))
    return { entries: parseChromeFormat(result.data), format: 'chrome' }
  if (headers.includes('formactionorigin') || headers.includes('httpRealm'))
    return { entries: parseFirefoxFormat(result.data), format: 'firefox' }
  return { entries: parseGenericFormat(result.data, headers), format: 'generic' }
}

function parseChromeFormat(data) {
  return data.filter(row => row.url || row.name).map(row => ({
    type: 'password', title: row.name || row.url || '未命名',
    username: row.username || '', password: row.password || '',
    url: row.url || '', notes: row.note || '',
  }))
}

function parseFirefoxFormat(data) {
  return data.filter(row => row.url).map(row => ({
    type: 'password', title: extractDomain(row.url),
    username: row.username || '', password: row.password || '',
    url: row.url || '', notes: '',
  }))
}

function parseGenericFormat(data, headers) {
  const titleKey = headers.find(h => /name|title|site|service/i.test(h)) || headers[0]
  const userKey = headers.find(h => /user|email|login|account/i.test(h))
  const passKey = headers.find(h => /pass|pwd|secret|key/i.test(h))
  const urlKey = headers.find(h => /url|link|website|site/i.test(h))
  const noteKey = headers.find(h => /note|memo|comment|desc/i.test(h))
  return data.filter(row => row[titleKey]).map(row => ({
    type: passKey && /key|secret|api/i.test(passKey) ? 'apikey' : 'password',
    title: row[titleKey] || '未命名',
    username: userKey ? row[userKey] || '' : '',
    password: row[passKey] || '',
    url: urlKey ? row[urlKey] || '' : '',
    notes: noteKey ? row[noteKey] || '' : '',
  }))
}

function extractDomain(url) { try { return new URL(url).hostname } catch { return url } }

function deduplicateEntries(entries) {
  const seen = new Map()
  return entries.filter(e => {
    const key = `${(e.url||'').toLowerCase()}|${(e.username||'').toLowerCase()}`
    if (seen.has(key)) return false
    seen.set(key, true)
    return true
  })
}

module.exports = { parseBrowserCSV, deduplicateEntries }
