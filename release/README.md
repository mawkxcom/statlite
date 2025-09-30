# Statlite

轻量级静态网站访问统计（类似“不蒜子”）。后端基于 TypeScript + Express + SQLite，前端提供一行代码即用的 JS SDK。

## 功能
- 站点总访问量（PV）、站点总访客数（UV）、页面阅读量（Page PV）
- 访客识别：IP + UserAgent 哈希（同时保存原始 ip / ua）
- 防刷：IP 级频控、同访客短期重复访问去重、异常流量检测
- 性能：SQLite WAL、必要索引、响应压缩、异步队列写库
- 安全：CORS 白名单、Helmet、安全响应头、输入验证、预编译SQL

## 目录结构
```
server/   # TypeScript + Express + SQLite 服务
sdk/      # 轻量JS SDK，打包为 IIFE（全局 Statlite）
public/   # 可用于部署时托管 SDK 文件
```

## 快速开始
```bash
# 1) 安装依赖（在仓库根目录）
npm install

# 2) 构建（可选，SDK 会在 dist 下产物）
npm run build

# 3) 启动开发服务（端口默认 8787）
npm run dev
```

健康检查：`GET http://localhost:8787/health` 返回 `{ ok: true }`。

## 环境变量
- `STATLITE_DATA`: 数据库存放目录（默认 `<cwd>/data`）。
- `STATLITE_CORS_ORIGINS`: 逗号分隔的 CORS 白名单，如：`https://a.com,https://b.com`。为空则放通任意来源。
- `PORT` / `STATLITE_PORT`: 服务端口（默认 `8787`）。也可通过 `--port=xxxx` 指定。

端口指定优先级：`--port` > `PORT/STATLITE_PORT` > 默认 `8787`。

示例：
```bash
# 通过环境变量指定
PORT=9000 npm run dev
STATLITE_PORT=9000 npm run dev

# 通过启动参数（dev）
npm -w @statlite/server run dev -- --port=9000

# 生产运行
npm run build
node server/dist/index.js --port=9000
```

## SDK 使用
将 SDK（IIFE）部署到站点可访问路径（示例使用本地路径）：
```html
<script src="/statlite/index.global.js" defer data-statlite-site="your-site-id" data-statlite-endpoint="https://your-api"></script>
<!-- 在需要显示统计的位置添加标签 -->
<span data-statlite="pv" data-site="your-site-id" data-endpoint="https://your-api"></span>
<span data-statlite="uv" data-site="your-site-id" data-endpoint="https://your-api"></span>
<span data-statlite="pagepv" data-site="your-site-id" data-endpoint="https://your-api"></span>
```

- `data-statlite-site`: 站点唯一 ID（可用域名或自定义字符串）
- `data-statlite-endpoint`: 后端 API 根地址（如 `https://api.example.com`）。

默认行为（可省略 data-site / data-endpoint）：
- `data-site` 省略时，默认取引用 SDK 的站点域名（`<script src>` 的 hostname）。
- `data-endpoint` 省略时，默认取引用 SDK 的站点 origin + `/statlite`，如 `https://example.com/statlite`。

### 属性说明与优先级
- `data-statlite-site`（挂在 `<script>` 上）：全局默认 site。页面内统计元素未设置 `data-site` 时继承此值。
- `data-site`（挂在统计元素上）：元素级覆盖 site。若设置则优先于 `data-statlite-site`。
- `data-statlite-endpoint`（挂在 `<script>` 上）：全局默认 endpoint。元素未设置 `data-endpoint` 时继承此值。
- `data-endpoint`（挂在统计元素上）：元素级覆盖 endpoint。若设置则优先于 `data-statlite-endpoint`。

优先级（高 → 低）：
1) 元素级：`data-site` / `data-endpoint`
2) 全局级：`data-statlite-site` / `data-statlite-endpoint`
3) 缺省值：脚本 src 的 hostname / origin + `/statlite`

SDK 会在 DOMContentLoaded 后自动：
- 上报访问 `POST /stats/track`
- 扫描页面中带有 `data-statlite` 的元素并填充对应数值（`GET /stats/summary`）

构建后的 SDK 文件位于：`sdk/dist/index.global.js`；你可以复制到你的静态资源目录（如 `public/statlite/index.global.js`）进行托管。

## API
- `POST /stats/track`
  - Body: `{ site: string; page: string; title?: string }`
  - 返回：`{ ok: true, site, page, title?, totalPv, totalUv, pagePv }`
- `GET /stats/summary?site=...&page=...`
  - 返回：`{ ok: true, site, totalPv, totalUv, pagePv? }`

访客识别：使用 `IP + UserAgent` 的 SHA-256 哈希（同时记录原始 IP/UA）。

## 防刷策略
- IP 级频控：默认每分钟 60 次（内存桶）。
- 同访客短期重复访问去重：同一访客同一页面 30 秒内不重复计数。
- 异常流量检测：在窗口内超出常规 5x 的访问视为异常，返回 429。

## 性能优化
- SQLite `WAL`、`foreign_keys` 开启。
- 写入采用异步队列批处理事务，降低锁竞争。
- 必要索引：`(site_id)`, `(site_id, page_path)`, `(visitor_id, created_at)`。
- 响应压缩（`compression`）。

## 安全
- CORS 白名单可配置；默认允许所有来源。
- Helmet + 自定义安全响应头。
- Zod 入参校验；SQL 使用预编译语句。

## 本地验证示例
```bash
# 健康检查
curl -s http://localhost:8787/health

# 上报一次访问
curl -s -X POST http://localhost:8787/stats/track \
  -H 'Content-Type: application/json' \
  -d '{"site":"demo","page":"/hello","title":"Hello"}'

# 汇总查询（站点 + 页面）
curl -s 'http://localhost:8787/stats/summary?site=demo&page=%2Fhello'
```

## 部署建议
- 反向代理保留 `X-Forwarded-For` 或 `X-Real-IP`，以便准确识别访客 IP。
- 设置 `STATLITE_DATA` 到持久化挂载目录。
- 仅放行受信任的前端 Origin 到 `STATLITE_CORS_ORIGINS`。
- 生产运行：`npm run build && node server/dist/index.js`。

## 发布与部署（可直接拷贝运行）
```bash
# 生成发布产物（在仓库根目录）
npm run release

# 生成目录：./release
# 包含：server/（已将 dist 平铺到 server 根目录，可直接 node server/index.js）、
#      public（含 /statlite/index.global.js）、README.md、start.sh

# 将 release 整个目录拷贝到服务器，进入后：
# 可选：自定义数据目录与端口
export STATLITE_DATA=/var/lib/statlite
export PORT=9000  # 或 STATLITE_PORT=9000

# 启动
./start.sh
```

说明：
- `start.sh` 会读取 `PORT` 或 `STATLITE_PORT`，也可默认端口 8787。
- `STATLITE_DATA` 未设置时，默认使用 `release/data` 目录。

### 发布注意事项（原生依赖与平台兼容）
- 本项目使用 `better-sqlite3` 原生模块，需在“目标服务器”上安装生产依赖以匹配其系统与 Node 版本。
- 发布脚本默认不会在本地为 `release/server` 安装依赖，避免将本地构建的二进制带到服务器引发 `invalid ELF header` 等错误。
- 正确做法：将 `release/` 上传至服务器后，执行：
  ```bash
  cd /path/to/release/server
  npm install --omit=dev
  cd .. && ./start.sh --port=8787
  ```
- 如需在本地就安装（不推荐，除非目标与本地平台/Node 完全一致），可在本地运行：
  ```bash
  RELEASE_INSTALL_DEPS=true npm run release
  ```

### SQLite 初始化与数据保留策略
- 数据库文件位置：由 `STATLITE_DATA` 指定目录中的 `statlite.sqlite`（默认在 `release/data`）。
- 初始化：首次运行若不存在数据库文件，会自动创建并执行迁移，无需手工建表。
- 迁移策略：使用 `CREATE TABLE/INDEX IF NOT EXISTS` 等幂等迁移，不会覆盖或清空已存在的数据。
- 建议：
  - 生产环境将 `STATLITE_DATA` 挂载到独立持久化目录（或云盘/卷）。
  - 备份时只需备份该目录即可保留全部统计数据。

## Docker 部署
仓库已提供 `Dockerfile`（基于 `node:18-alpine`）。推荐先在本地生成 `release/`，再构建镜像：
```bash
npm run release
docker build -t statlite:latest .
# 运行（将数据目录挂载到宿主机）
docker run -d \
  -p 8787:8787 \
  -e PORT=8787 \
  -e STATLITE_DATA=/data \
  -v /var/lib/statlite:/data \
  --name statlite statlite:latest
```

## systemd 部署示例
已提供 `systemd/statlite.service`：
```bash
# 将 release/ 拷贝到 /opt/statlite
sudo mkdir -p /opt/statlite
sudo cp -r release/* /opt/statlite/

# 安装服务单元
sudo cp systemd/statlite.service /etc/systemd/system/statlite.service
sudo systemctl daemon-reload
sudo systemctl enable --now statlite

# 查看状态
systemctl status statlite
```

## 许可证
MIT
