---
paths: ["electron/crypto/**", "electron/main.js"]
---

# 安全规则

## Argon2id 参数

- memoryCost: 65536 (64 MB), timeCost: 3, parallelism: 1, hashLength: 32, saltLength: 16
- 参数不可降级，不可为了性能减少任何一个值
- salt 必须每次随机生成 (crypto.randomBytes(16))

## AES-256-GCM

- nonce: 12 字节随机生成，每次加密必须不同
- auth tag: 16 字节
- 存储格式: base64(nonce || tag || ciphertext)
- 同一密钥加密次数上限 ~2^32 (生日攻击)，对密码管理器不是实际问题

## 密钥管理

- zeroBuffer 定义在 `encryption.cjs` 中，不在 `key-derivation.cjs` 中
- main.js 导入: `const { zeroBuffer } = require('./crypto/encryption.cjs')`
- lockApp() 必须调用 zeroBuffer(encryptionKey)
- settings:change-password 必须先 zeroBuffer 旧密钥再赋值新密钥

## 禁止事项

- ❌ 明文存储密码或密钥
- ❌ 硬编码密钥、salt、IV
- ❌ console.log 输出密码、密钥、加密数据
- ❌ 日志中记录任何敏感字段内容
- ❌ 在渲染进程中访问 encryptionKey

## Gotchas

1. **salt 不要写死**: extractSalt() 从存储的哈希中提取，不要自己构造 Buffer
2. **timingSafeEqual 长度必须相同**: verifyPassword 中 actualHash 和 expectedHash 都是 32 字节，如果长度不同会抛异常，需要 try/catch
3. **加密字段 null 处理**: encryptField(null) 返回 null，decryptField(null) 返回 null，不要假设返回值一定是字符串
