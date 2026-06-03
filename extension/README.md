# KeyVault Browser Extension

安全的密码管理器浏览器扩展，支持自动填充和密码保存。

## 功能特性

- 🔐 **自动填充** - 检测登录表单，自动匹配并填充凭据
- 💾 **密码保存** - 监听表单提交，提示保存新密码
- 🔍 **快速搜索** - 在弹出窗口中搜索凭据
- 📋 **一键复制** - 快速复制用户名或密码
- 🔒 **安全通信** - 通过 Native Messaging 与 KeyVault 应用通信

## 安装说明

### 前提条件

1. 已安装 KeyVault 桌面应用
2. 应用正在运行

### 安装步骤

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension` 目录

### 注册 Native Messaging Host

在 KeyVault 应用的设置中，点击"注册浏览器扩展"按钮，或手动运行：

```bash
node electron/native-messaging/register-host.cjs register
```

## 使用方法

### 自动填充

1. 访问需要登录的网站
2. 将鼠标悬停在密码输入框上
3. 点击出现的 KeyVault 图标
4. 选择要填充的凭据

### 保存密码

1. 在网站上登录
2. 提交表单后，KeyVault 会提示是否保存密码
3. 点击"保存"将密码存储到 KeyVault

### 弹出窗口

1. 点击浏览器工具栏中的 KeyVault 图标
2. 查看当前网站匹配的凭据
3. 点击凭据进行填充或复制

## 安全说明

- 扩展不存储任何凭据数据
- 所有数据通过 Native Messaging 实时从 KeyVault 应用获取
- 需要 KeyVault 应用处于解锁状态
- 连接超时（5 秒）自动断开

## 开发说明

### 文件结构

```
extension/
├── manifest.json          # 扩展配置
├── background.js          # 后台服务
├── content.js            # 内容脚本
├── popup.html            # 弹出窗口
├── popup.js              # 弹出窗口逻辑
├── styles/
│   ├── content.css       # 内容脚本样式
│   └── popup.css         # 弹出窗口样式
├── icons/                # 扩展图标
└── README.md             # 说明文档
```

### 调试方法

1. 打开 Chrome 开发者工具
2. 在 Console 中查看扩展日志
3. 使用 `chrome.runtime.sendMessage` 测试通信

## 许可证

MIT License
