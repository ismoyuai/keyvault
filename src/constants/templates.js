export const TEMPLATES = {
  password: {
    id: 'password',
    name: '网站密码',
    icon: 'Key',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: '密码', type: 'password', required: true },
      { key: 'url', label: '网址', type: 'url', required: false },
    ],
  },
  apikey: {
    id: 'apikey',
    name: 'API 密钥',
    icon: 'Code',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: 'API Key', type: 'password', required: true },
      { key: 'url', label: 'Endpoint', type: 'url', required: false },
    ],
    customFieldPresets: [
      { key: 'rate_limit', label: 'Rate Limit', type: 'text' },
    ],
  },
  note: {
    id: 'note',
    name: '安全笔记',
    icon: 'FileText',
    fields: [
      { key: 'notes', label: '内容', type: 'textarea', required: false },
    ],
  },
  server: {
    id: 'server',
    name: '服务器',
    icon: 'Server',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: '密码/密钥', type: 'password', required: true },
    ],
    customFieldPresets: [
      { key: 'host', label: 'Host', type: 'text' },
      { key: 'port', label: 'Port', type: 'text' },
      { key: 'ssh_key', label: 'SSH Key', type: 'textarea' },
    ],
  },
  cloud: {
    id: 'cloud',
    name: '云服务',
    icon: 'Cloud',
    fields: [
      { key: 'username', label: '账号', type: 'text', required: false },
      { key: 'password', label: 'Secret Key', type: 'password', required: true },
    ],
    customFieldPresets: [
      { key: 'service', label: '服务商', type: 'text' },
      { key: 'access_key', label: 'Access Key', type: 'text' },
      { key: 'region', label: 'Region', type: 'text' },
    ],
  },
  software: {
    id: 'software',
    name: '软件许可证',
    icon: 'Package',
    fields: [
      { key: 'username', label: '注册邮箱', type: 'email', required: false },
      { key: 'password', label: 'License Key', type: 'password', required: true },
    ],
    customFieldPresets: [
      { key: 'expiry_date', label: '过期时间', type: 'date' },
    ],
  },
  identity: {
    id: 'identity',
    name: '身份信息',
    icon: 'User',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
    ],
    customFieldPresets: [
      { key: 'email', label: '邮箱', type: 'email' },
      { key: 'phone', label: '电话', type: 'text' },
      { key: 'address', label: '地址', type: 'textarea' },
    ],
  },
  crypto_wallet: {
    id: 'crypto_wallet',
    name: '加密钱包',
    icon: 'Wallet',
    fields: [
      { key: 'username', label: '钱包名称', type: 'text', required: false },
      { key: 'password', label: '密码', type: 'password', required: false },
    ],
    customFieldPresets: [
      { key: 'address', label: '地址', type: 'text' },
      { key: 'private_key', label: '私钥', type: 'password' },
      { key: 'mnemonic', label: '助记词', type: 'textarea' },
    ],
  },
  ssh_key: {
    id: 'ssh_key',
    name: 'SSH 密钥',
    icon: 'Terminal',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: 'Passphrase', type: 'password', required: false },
    ],
    customFieldPresets: [
      { key: 'public_key', label: '公钥', type: 'textarea' },
      { key: 'private_key', label: '私钥', type: 'textarea' },
    ],
  },
  custom: {
    id: 'custom',
    name: '自定义',
    icon: 'File',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: '密码', type: 'password', required: false },
    ],
  },
}

export const TEMPLATE_LIST = Object.values(TEMPLATES)

export function getTemplate(id) {
  return TEMPLATES[id] || TEMPLATES.custom
}

export function getTemplateIcon(id) {
  const template = getTemplate(id)
  return template.icon
}
