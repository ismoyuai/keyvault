---
paths: ["electron/storage/**"]
---

# 数据库规则

## sql.js (WASM SQLite)

- `initDatabase(filePath)` 是 async，必须 await
- 底层是 WASM，所有操作在内存中，需要显式 `saveDb()` 持久化到磁盘
- 没有原生 prepared statement 缓存，每次 queryAll 创建新的 stmt

## 加密字段

所有敏感字段必须 encryptField/decryptField:
- title_encrypted, username_encrypted, password_encrypted
- url_encrypted, notes_encrypted, tags_encrypted, name_encrypted (groups)

非敏感字段明文存储: id, type, group_id, favorite, created_at, updated_at, device_id, deleted

## 写操作流程

```
db.run(SQL, params)  →  saveDb()  →  数据写入磁盘
```

每次写操作后必须调用 saveDb()。批量操作使用 addEntries() 内部只调用一次 saveDb()。

## 读操作

- `queryAll(sql, params)` — 返回数组，自动 stmt.free() (try/finally)
- `queryOne(sql, params)` — 返回第一行或 null
- 不要手动调用 db.prepare()/stmt.step()/stmt.free()

## 事务

```javascript
beginTransaction()
try {
  db.run(...)
  db.run(...)
  commit()
  saveDb()
} catch (e) {
  rollback()
  throw e
}
```

注意: saveDb() 内部调用 db.export()，在事务未 commit 时调用会失败。

## 禁止事项

- ❌ 字符串拼接 SQL (使用参数化查询 `?`)
- ❌ 在事务未 commit 时调用 saveDb()
- ❌ 忘记 saveDb() 导致数据只在内存中
- ❌ 直接操作 db.prepare() (使用 queryAll/queryOne)

## Gotchas

1. **sql.js 没有 WAL 模式**: 所有写操作串行执行，不要期望并发写入
2. **export() 返回 Uint8Array**: saveDb() 中需要 `Buffer.from(data)` 转换后才能 fs.writeFileSync
3. **软删除不物理删除**: deleteEntry 只设置 deleted=1，需要定期调用 purgeDeleted() 清理
4. **索引已添加**: type, group_id, favorite, deleted 字段有索引，查询这些字段时自动使用
