# Portal custom domains design

## 1. 背景

SeaTicket Portal 面向终端用户提供工单提交、工单查看、知识库和 Chat 能力。为了让租户能用自己的品牌入口访问 Portal，系统支持三类域名：

1. 默认随机子域名，例如 `x765cd.seaticket-portal.ai`
2. 租户自定义子域名，例如 `my-brand.seaticket-portal.ai`
3. 租户自有域名，例如 `support.customer.com`

该设计基于同一套 Django 代码，通过运行模式和 Host 解析实现主站管理面与 Portal 访问面的隔离。

## 2. 目标

- 为每个启用 Portal 的项目提供可访问的默认 Portal 域名。
- 支持项目管理员配置品牌化子域名前缀。
- 支持客户绑定自有域名，并通过 DNS TXT 记录完成所有权验证。
- 支持 Caddy On-Demand TLS 为客户自有域名自动申请和续期证书。
- Portal 模式下使用扁平 URL，客户域名访问 `/` 即进入该项目 Portal。
- 主站和 Portal 运行面隔离，减少管理面暴露。
- 保证域名解析、缓存、证书 ask 接口在并发和缓存场景下行为稳定。

## 3. 非目标

- 不在本设计中实现多套应用或多套数据库。
- 不在自定义域名 ask 接口上使用用户级认证。该接口由 Caddy 调用，不具备普通用户 session/token。
- 不为未启用 Portal 的项目自动创建 Portal alias。Portal alias 的正常创建发生在启用 Portal 时，历史已启用但缺失 alias 的项目会在读取域名配置时补创建。
- 不提供 alias 的临时禁用能力。`PortalDomainAlias.enabled` 字段已移除，Portal 是否可访问由项目 Portal 开关控制。
- 不在绑定自有域名后物理删除 Portal alias。自有域名 verified 后，Portal alias 作为兼容入口 302 redirect 到自有域名。

## 4. 术语

| 术语 | 含义 |
| --- | --- |
| Main mode | 主站模式，处理项目管理、配置、租户开通等管理业务 |
| Portal mode | Portal 模式，仅暴露面向终端用户的 Portal 页面和必要 API |
| Portal alias | SeaTicket 服务根域下绑定项目的当前子域名前缀 |
| Initial random alias | 启用 Portal 时系统生成的初始随机前缀 |
| Branded alias | 用户把当前 Portal alias 更新成更有品牌识别度的前缀 |
| Custom domain | 用户自有域名，需要 DNS TXT 验证 |
| Portal service root domain | SeaTicket 提供的 Portal 根域，例如 `seaticket-portal.ai` |
| TLS ask | Caddy On-Demand TLS 申请证书前调用的允许性检查接口 |

## 5. 总体架构

### 5.1 运行模式

同一套 Django 应用通过 `SEAQA_APP_MODE` 控制运行模式。

```text
Main mode
  Host: seaticket.ai
  URLConf: seahub.urls
  用途: 管理后台、项目配置、Portal 配置、预览 token 创建

Portal mode
  Host: *.seaticket-portal.ai, customer-owned domains
  URLConf: seahub.portal_site_urls
  用途: 终端用户 Portal 页面、Portal API、Portal 文件、TLS ask
```

关键 settings：

```python
SEAQA_APP_MODE = os.environ.get('SEAQA_APP_MODE', 'main')
IS_PORTAL_MODE = SEAQA_APP_MODE == 'portal'
SITE_ROOT_URLCONF = 'seahub.portal_site_urls' if IS_PORTAL_MODE else 'seahub.urls'
```

Portal 模式加载：

- `seahub.portal.middleware.PortalDomainMiddleware`
- `django.middleware.csrf.CsrfViewMiddleware`
- `seahub.portal_site_urls`

Main 模式加载普通 CSRF middleware 和完整主站 URL surface。

### 5.2 请求链路

```text
Client
  |
  v
Caddy
  |
  |-- seaticket.ai -----------------------> Main Django
  |
  |-- *.seaticket-portal.ai --------------> Portal Django
  |
  |-- customer-owned domain --------------> Portal Django
       | before TLS cert: Caddy ask /internal/portal/custom-domain/allow-tls
```

Portal Django 在请求进入视图前通过 Host 解析项目：

```text
Host
  |
  |-- 子域名 *.PORTAL_SERVICE_ROOT_DOMAIN
  |     -> get_portal_subdomain_prefix()
  |     -> portal_domain_aliases.prefix
  |
  |-- 自有域名
        -> portal_custom_domains.domain
        -> verified=True
```

解析成功后，middleware 将根路径或扁平路径重写为内部路径：

```text
https://my-brand.seaticket-portal.ai/
  -> /portal/<project_uuid>/

https://support.customer.com/my-issues/
  -> /portal/<project_uuid>/my-issues/

https://support.customer.com/external/accept/<token>/
  -> /portal-external/accept/<token>/<project_uuid>/
```

### 5.3 GitHub Pages 对照

GitHub Pages 的公开行为可以作为参考，但不完全等同于 SeaTicket Portal：

| 能力 | GitHub Pages | SeaTicket Portal |
| --- | --- | --- |
| 默认域名 | 基于账号/仓库生成，例如 `<user>.github.io` 或 `<user>.github.io/<repo>` | 系统随机生成，例如 `x765cd.seaticket-portal.ai` |
| 品牌子域名 | 不提供用户自定义的 `*.github.io` 品牌前缀 | 支持用户把初始随机前缀更新为 `my-brand.seaticket-portal.ai` |
| 自有域名 | 支持 apex/subdomain custom domain，通过 DNS 配置和域名验证保护 | 支持 `support.customer.com`，通过 DNS TXT 验证所有权 |
| 自有域名启用后的默认域名 | 通常保留默认 GitHub Pages 地址，并将其作为站点的备用或重定向入口 | 自有域名 verified 后，Portal alias 请求 302 redirect 到自有域名 |
| 证书 | 平台托管证书 | 服务子域名使用通配符证书，自有域名使用 Caddy On-Demand TLS |

GitHub 的核心取舍是：默认平台域名提供稳定兜底，自有域名提供品牌入口。SeaTicket 采用相同方向，但额外提供一个品牌子域名层级，用于客户在购买或配置自有域名前先获得可识别的 Portal 地址。

### 5.4 Canonical 域名策略

当前策略为 `redirect_to_custom`：

```text
verified custom domain: support.customer.com
portal alias:           my-brand.seaticket-portal.ai

二者都指向同一个 project_uuid。自有域名未验证时，Portal alias 直接访问 Portal；自有域名验证通过后，Portal alias 请求 302 跳转到 verified custom domain。
```

选择该策略的原因：

- 自有域名 DNS 和 TLS 初次生效可能有延迟，未验证前 Portal alias 可作为兜底入口。
- 自有域名验证成功后，Portal alias 统一跳转到自有域名，避免同一 Portal 被两个域名长期平级访问。
- 现有外部邀请链接、邮件链接或用户收藏的旧 Portal alias 入口不会立即失效，会被引导到 canonical custom domain。

Preview URL 生成时做优先级选择：

```text
verified custom domain > portal alias > current request host
```

External invitation URL 使用相同的域名优先级：如果项目已有 verified custom domain，则生成自有域名下的扁平接受链接；否则使用 Portal alias 下的扁平接受链接；如果 Portal alias 不可用，才回退到主站 `SEAQA_WEB_SERVICE_URL` 下的标准 `/portal-external/accept/<token>/<project_uuid>/` 链接。

配置成功后新生成的 preview URL 会优先使用自有域名。直接访问 Portal alias 时，middleware 会保留原 path 和 query string，并返回 302 到自有域名：

```text
https://my-brand.seaticket-portal.ai/my-issues/?page=1
  -> 302 https://support.customer.com/my-issues/?page=1
```

这里使用 302，而不是 301。原因是客户可能后续解绑或更换自有域名，永久跳转容易被浏览器或中间缓存长期保留。

## 6. 配置项

### 6.1 必需配置

| 配置 | 示例 | 说明 |
| --- | --- | --- |
| `SEAQA_APP_MODE` | `main` / `portal` | 运行模式 |
| `SEATICKET_SERVER_HOSTNAME` | `seaticket.ai` | 主站域名 |
| `SEATICKET_SERVER_PROTOCOL` | `https` | 主站 URL scheme，用于生成 `SEAQA_WEB_SERVICE_URL` |
| `PORTAL_SERVICE_ROOT_DOMAIN` | `seaticket-portal.ai` | Portal 服务根域 |
| `PORTAL_CUSTOM_DOMAIN_DNS_TARGET` | `custom-domains.seaticket-portal.ai` | 客户 CNAME 指向目标 |

`PORTAL_SERVICE_ROOT_DOMAIN` 必须是 Portal 平台子域名的独立命名空间，不应与 `SEATICKET_SERVER_HOSTNAME` 相同。原因：

- 主站域名由 main mode 处理，Portal 服务根域和其通配符子域名由 portal mode 处理。
- Caddy 需要把主站和 Portal service host 分到不同 site block，避免同一个 Host 被两个入口竞争。
- middleware 会把 `PORTAL_SERVICE_ROOT_DOMAIN` 及其一级子域名识别为 Portal service host。如果它与主站域名相同，会削弱主站和 Portal 的 Cookie、CSRF、路由隔离。

线上如果主站是：

```bash
SEATICKET_SERVER_HOSTNAME=ticket.seafile.com
```

推荐 Portal service root 使用独立域名，例如：

```bash
PORTAL_SERVICE_ROOT_DOMAIN=ticket-portal.seafile.com
```

对应的平台随机域名和品牌域名为：

```text
x765cd.ticket-portal.seafile.com
my-brand.ticket-portal.seafile.com
```

### 6.2 Main mode 示例

```bash
SEAQA_APP_MODE=main
SEATICKET_SERVER_HOSTNAME=seaticket.ai
SEATICKET_SERVER_PROTOCOL=https
PORTAL_SERVICE_ROOT_DOMAIN=seaticket-portal.ai
PORTAL_CUSTOM_DOMAIN_DNS_TARGET=custom-domains.seaticket-portal.ai
```

Main mode 必须能读到 `PORTAL_SERVICE_ROOT_DOMAIN`，因为项目从未启用 Portal 切换到启用 Portal 时会创建默认随机子域名。

### 6.3 Portal mode 示例

```bash
SEAQA_APP_MODE=portal
SEATICKET_SERVER_HOSTNAME=seaticket.ai
SEATICKET_SERVER_PROTOCOL=https
PORTAL_SERVICE_ROOT_DOMAIN=seaticket-portal.ai
PORTAL_CUSTOM_DOMAIN_DNS_TARGET=custom-domains.seaticket-portal.ai
```

Portal mode 必须能读到：

- `PORTAL_SERVICE_ROOT_DOMAIN`：识别服务子域名。
- `PORTAL_CUSTOM_DOMAIN_DNS_TARGET`：用于前端展示自有域名 DNS 配置目标。

### 6.4 限流配置

TLS ask 接口使用 DRF throttle scope：

```python
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['portal_tls_ask'] = '300/minute'
```

测试配置中该值为较大值，避免测试误触发限流。

## 7. 数据模型

### 7.1 `portal_domain_aliases`

存储 SeaTicket 服务域名下的当前子域名前缀。一个项目只有一条记录。

```sql
CREATE TABLE `portal_domain_aliases` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `prefix` varchar(63) NOT NULL,
  `project_uuid` char(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `portal_domain_aliases_prefix_uniq` (`prefix`),
  UNIQUE KEY `portal_domain_aliases_project_uuid_uniq` (`project_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `prefix` | 子域名前缀，例如 `x765cd` 或 `my-brand` |
| `project_uuid` | 绑定项目 |

约束：

- `prefix` 全局唯一，避免两个项目使用同一个子域名。
- `project_uuid` 唯一，一个项目只有一个服务子域名。
- 不再有 `enabled` 字段和 `alias_type` 字段。Portal alias 是否可访问由项目 Portal 开关控制；随机前缀和品牌前缀只是同一条记录在不同时刻的值。

设计原因：

- 启用 Portal 时系统必须给项目一个立即可用的随机子域名。
- 用户配置品牌子域名时，本质是把当前随机 prefix 更新为品牌 prefix，而不是额外新增一个入口。
- 这样前端只需要维护一个可编辑的服务子域名前缀，数据表也不需要区分 `default/custom` 两类 alias。

### 7.2 `portal_custom_domains`

存储客户自有域名及所有权验证状态。

```sql
CREATE TABLE `portal_custom_domains` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `domain` varchar(255) NOT NULL,
  `project_uuid` char(36) NOT NULL,
  `verification_token` varchar(64) NOT NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `verified_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `portal_custom_domains_domain_uniq` (`domain`),
  UNIQUE KEY `portal_custom_domains_project_uuid_uniq` (`project_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `domain` | 规范化后的客户域名，例如 `support.customer.com` |
| `project_uuid` | 绑定项目 |
| `verification_token` | DNS TXT 验证 token |
| `verified` | DNS 所有权是否验证通过 |
| `verified_at` | 验证通过时间 |

约束：

- 一个域名只能绑定一个项目。
- 一个项目只能绑定一个客户自有域名。

## 8. 缓存设计

### 8.1 Alias cache

`PortalDomainAlias.objects.get_by_prefix()` 使用缓存：

```text
key: portal_domain_alias:prefix:<normalized_prefix>
positive ttl: 300s
miss ttl: 60s
positive value fields: prefix, project_uuid
miss value: __portal_domain_cache_miss__
```

读取流程：

1. 规范化 prefix。
2. 读取 `portal_domain_alias:prefix:<normalized_prefix>`。
3. 如果缓存值是 alias dict，直接返回绑定信息。
4. 如果缓存值是 miss sentinel，直接返回 `None`。
5. 缓存未命中时查询 `portal_domain_aliases`。
6. DB 命中则缓存 alias dict 300 秒；DB 未命中则缓存 miss sentinel 60 秒。

写入、更新、删除 alias 时清理对应 prefix cache。positive cache 和 miss cache 使用同一个 key，因此创建一个此前不存在的 prefix 时会立刻清理旧 miss cache，不需要等待 60 秒 TTL。

`PortalDomainAlias.objects.get_by_project_uuid()` 也使用缓存：

```text
key: portal_domain_alias:project:<project_uuid>
positive ttl: 300s
miss ttl: 60s
positive value fields: prefix, project_uuid
miss value: __portal_domain_cache_miss__
```

这个缓存用于需要从项目反查当前 Portal alias 的场景，例如 external invitation URL 生成。写入、更新、删除 alias 时同时清理 prefix cache 和 project cache。

### 8.2 Custom domain cache

`PortalCustomDomain.objects.get_by_domain()` 使用缓存：

```text
key: portal_custom_domain:domain:<normalized_domain>
positive ttl: 300s
miss ttl: 60s
positive value fields: domain, project_uuid, verified
miss value: __portal_domain_cache_miss__
```

读取流程：

1. 规范化 domain。
2. 读取 `portal_custom_domain:domain:<normalized_domain>`。
3. 如果缓存值是 custom domain dict，直接返回绑定信息。
4. 如果缓存值是 miss sentinel，直接返回 `None`。
5. 缓存未命中时查询 `portal_custom_domains`。
6. DB 命中则缓存 custom domain dict 300 秒；DB 未命中则缓存 miss sentinel 60 秒。

写入、更新、删除 custom domain 时清理：

- 新 domain cache。
- 旧 domain cache。
- 新旧 domain 的 TLS ask cache。

positive cache 和 miss cache 使用同一个 key，因此保存一个此前不存在的 customer-owned domain 时会立刻清理旧 miss cache。

`PortalCustomDomain.objects.get_verified_by_project_uuid()` 也使用缓存：

```text
key: portal_custom_domain:verified_project:<project_uuid>
positive ttl: 300s
miss ttl: 60s
positive value fields: domain, project_uuid, verified
miss value: __portal_domain_cache_miss__
```

这个缓存用于 service alias 的 canonical redirect 场景。请求命中 `portal_domain_aliases` 后，middleware 需要判断当前项目是否已经配置 verified customer-owned domain；如果存在，则把平台域名 302 到客户自有域名。该查询按 `project_uuid` 发生，不能复用按 `domain` 查询的 cache，因此单独维护 project cache。

写入、更新、删除 custom domain 时同时清理：

- domain cache。
- verified project cache。
- TLS ask cache。

### 8.3 TLS ask cache

TLS ask 结果使用短缓存：

```text
key: portal_tls_ask_allowed:<normalized_domain>
ttl: 60s
value: True / False
```

TLS ask cache 缓存的是“是否允许 Caddy 为该自有域名申请证书”。它只用于 customer-owned domain，不用于平台随机域名或品牌域名。平台随机域名和品牌域名由 wildcard 证书覆盖。

### 8.4 每次请求的 DB 查询边界

Portal mode 每个请求都会先解析 Host：

```text
Host -> resolve_portal_domain(host)
```

DB 查询边界如下：

- 已知 service alias：第一次请求查 `portal_domain_aliases.prefix`，后续 300 秒走 alias prefix positive cache；如果需要判断是否 redirect 到 verified customer-owned domain，则第一次按 `project_uuid` 查 `portal_custom_domains`，后续 300 秒走 verified project cache。
- external invitation URL 生成：第一次按 `project_uuid` 查 `portal_domain_aliases`，后续 300 秒走 alias project positive cache；项目没有 alias 时短暂缓存 miss 60 秒，创建 alias 时立即清理。
- 未知 service alias：第一次请求查 `portal_domain_aliases`，后续 60 秒走 alias miss cache；并且不会继续查询 `portal_custom_domains`。
- 已知 customer-owned domain：第一次请求查 `portal_custom_domains`，后续 300 秒走 custom domain positive cache。
- 未知 customer-owned domain：第一次请求查 `portal_custom_domains`，后续 60 秒走 custom domain miss cache。
- Caddy ask：额外使用 `portal_tls_ask_allowed:<domain>` 缓存 true/false 60 秒。

因此不会在每个请求上反复查询数据库确认域名是否存在。短 TTL miss cache 用来抵抗未知 Host 扫描，同时保证新绑定域名能在保存时通过 cache invalidation 立即生效。

### 8.5 规范化边界

调用约定：

- public lookup 入口负责规范化一次：`PortalDomainAlias.objects.get_by_prefix()`、`PortalDomainAlias.objects.get_by_host()`、`PortalCustomDomain.objects.get_by_domain()`。
- private cache key helper 不做 normalize：`_prefix_cache_key()` 和 `_domain_cache_key()` 只接收已规范化的 prefix/domain。
- model `save/delete/delete_by_project_uuid()` 使用数据库中已规范化保存的 prefix/domain 清理 cache，不再重复 normalize，包括 TLS ask cache。
- `get_portal_tls_ask_cache_key(domain)` 只拼接 key，不做 normalize。调用方必须传入规范化后的 domain。
- TLS ask view 先调用 `normalize_portal_custom_domain()`，再生成 key。

## 9. 核心算法

### 9.1 域名规范化

#### 自有域名

`normalize_portal_custom_domain(domain)`：

1. trim + lower。
2. 拒绝 scheme，例如 `https://...`。
3. 拒绝 path/query/fragment。
4. 去掉末尾 `.`。
5. IDNA 编码为 ASCII。
6. 拒绝端口。
7. 长度不超过 253。
8. 至少两个 label。
9. TLD 不能纯数字。
10. 每个 label 必须符合 `HOST_LABEL_RE`。
11. 默认检查保留域名：
    - 主站域名。
    - `PORTAL_SERVICE_ROOT_DOMAIN` 及其子域名。

#### 服务子域名前缀

`normalize_portal_subdomain_prefix(prefix)`：

1. trim + lower。
2. IDNA 编码。
3. 长度 3 到 63。
4. 只能是合法 DNS label，不能以 `-` 开始或结束。

保留前缀包括：

```text
admin, api, assets, auth, cdn, custom-domains, internal, mail, media,
static, status, support, www
```

如果 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET` 位于 `PORTAL_SERVICE_ROOT_DOMAIN` 下，其前缀也会自动加入保留列表。

### 9.2 Portal alias 创建

Portal alias 在项目 Portal 启用后必须存在。用户没有配置自定义子域名前缀时，系统创建一个随机 prefix 作为 Portal alias；用户后续配置品牌子域名时，是更新同一条 alias 记录。

触发点：

```text
PUT /api/v1/workspace/<workspace_id>/project/
request body contains settings
```

算法：

```text
old_enable_portal = current project.settings.portal.enable_portal
merge incoming settings
new_enable_portal = merged project.settings.portal.enable_portal

should_init_portal_issues = (not old_enable_portal and new_enable_portal)
should_ensure_portal_alias = (
    new_enable_portal
    and PORTAL_SERVICE_ROOT_DOMAIN configured
)

if should_ensure_portal_alias:
    PortalDomainAlias.objects.ensure_alias(project.uuid)

save project settings

if should_init_portal_issues:
    ensure_portal_issues_seadb_table()
```

关键点：

- Portal issue 表初始化只在 `false -> true` 时执行，避免重复建表。
- Portal alias 使用 `ensure_alias()`，是幂等操作。只要本次保存 settings 后 Portal 为 enabled，且 `PORTAL_SERVICE_ROOT_DOMAIN` 已配置，就确保该项目有 alias。
- 如果项目还没有 alias，`ensure_alias()` 会创建随机 prefix；如果已有 alias，不会覆盖用户当前配置的 prefix。
- alias 创建在 project settings 保存前执行。这样 alias 创建失败时，不会先把项目保存成 enabled 但没有 alias。
- 历史已 enabled 但缺 alias 的项目，在下一次保存 Portal settings 或读取 domain alias 配置时会补创建 alias。
- 不提交 settings 的普通项目更新不会触发 alias 创建。

`ensure_alias(project_uuid)`：

1. 查询该项目已有 alias，存在则返回。
2. 随机生成 6 位小写字母和数字前缀。
3. 跳过保留前缀。
4. 确认 prefix 未被占用。
5. 插入 alias。
6. 如果唯一键冲突：
   - 若同项目 alias 已存在，返回现有记录。
   - 否则重试，最多 10 次。

说明：

- 读取 domain alias 配置接口会先查询已有 alias；只有项目已启用 Portal、`PORTAL_SERVICE_ROOT_DOMAIN` 已配置且 alias 缺失时，才调用 `ensure_alias()` 补创建随机 prefix。
- 对历史已启用但缺 alias 的项目，打开设置页读取 domain alias 配置即可补出随机 prefix。
- 未启用 Portal 的项目不会因为读取配置而创建 alias。

### 9.3 Portal alias 更新

接口收到 `custom_subdomain_prefix` 后：

1. 空值表示不使用品牌子域名前缀，重置当前 alias 为新的随机 prefix；如果当前项目还没有 alias，则先创建 alias 再分配随机 prefix。
2. 非空时要求 `PORTAL_SERVICE_ROOT_DOMAIN` 已配置，否则返回 400。
3. 规范化 prefix。
4. 检查保留前缀。
5. 查询 prefix 是否被其他项目使用。
6. 当前项目已有 alias 则更新 prefix，否则创建。
7. 捕获 DB 唯一键冲突，返回 `custom_subdomain_prefix already in use.`。

### 9.4 自有域名绑定

绑定自有域名时：

1. 规范化 domain。
2. 拒绝主站域名、Portal 根域及其子域名。
3. 拒绝已被其他项目绑定的 domain。
4. 若项目已有绑定：
   - domain 未变化：保留原验证状态。
   - domain 变化：重置验证 token、`verified=False`、`verified_at=None`。
5. 若项目无绑定：创建记录并生成 token。

### 9.5 DNS TXT 验证

TXT 记录格式：

```text
record name: _seaqa-portal-challenge.<domain>
record value: seaqa-portal-verification=<verification_token>
```

验证接口查询 TXT 记录，匹配成功后：

```text
verified = True
verified_at = timezone.now()
```

### 9.6 Host 解析

`seahub.portal.utils.resolve_portal_domain(host)`：

1. 尝试按服务子域名解析：
   - 规范化 host，去掉端口和末尾 `.`
   - `get_portal_subdomain_prefix(host)`
   - `PortalDomainAlias.objects.get_by_prefix(prefix)`
   - 命中则返回 `domain_type=service_alias`，并通过当前 alias prefix 构造完整 service domain
2. 如果 host 属于 `PORTAL_SERVICE_ROOT_DOMAIN` 或其子域名，但没有命中 alias，直接返回 `None`。服务域名空间只按 alias 解析，不继续作为客户自有域名查询。
3. 尝试按客户自有域名解析：
   - `PortalCustomDomain.objects.get_by_domain(host)`
   - 仅 `verified=True` 才返回 `domain_type=custom`
4. 都未命中则返回 `None`。

这里的 alias miss 是针对“当前请求 Host”的解析结果，不表示项目没有 Portal alias。客户自有域名例如 `support.customer.com` 本来就不属于 `PORTAL_SERVICE_ROOT_DOMAIN`，因此第一步一定不会命中 `PortalDomainAlias`，必须继续查询 `PortalCustomDomain` 才能把该 Host 解析到项目。启用 Portal 时创建的随机 alias 是项目的服务子域名入口，不替代客户自有域名 lookup。

### 9.7 Portal middleware

`seahub.portal.middleware.PortalDomainMiddleware` 只在 Portal mode 加载，负责在 view 执行前完成 Host 到项目的解析、canonical redirect、租户一致性校验和扁平 URL rewrite。

输入：

```text
request.path_info
request.get_host()
settings.SEATICKET_SERVER_HOSTNAME
settings.PORTAL_SERVICE_ROOT_DOMAIN
portal_domain_aliases
portal_custom_domains
```

算法按执行顺序分为以下阶段。

#### 9.7.1 路径预处理

middleware 首先读取原始路径，并生成一个标准化路径：

```text
path = request.path_info or "/"
normalized_path = "/" + path.lstrip("/")
normalized_path = normalized_path.rstrip("/") or "/"
```

这一步不做路由分发，只把路径整理成稳定格式，后续用于判断 pass-through、提取 `project_uuid`、以及把扁平路径改写成内部标准 Portal 路径。

#### 9.7.2 Host 读取和主站跳过

然后在 Django URL routing 之前读取请求 Host：

```text
request_host = get_request_host_without_port(request)
if request_host is empty:
    pass through

if request_host == SEATICKET_SERVER_HOSTNAME:
    pass through
```

`get_request_host_without_port(request)` 会调用 `request.get_host()`，去掉端口、转小写并去掉末尾 `.`。如果 Django 因 `DisallowedHost` 拒绝 Host，则回退读取 `HTTP_HOST` 或 `SERVER_NAME`。

如果请求 Host 是主站域名，middleware 直接透传，不参与 Portal 域名解析。主站路由不应该被 Portal 域名逻辑改写。

#### 9.7.3 Host 到项目的解析

接着根据 Host 解析项目：

```text
portal_domain = resolve_portal_domain(request_host)
if portal_domain is None:
    pass through

request.portal_domain = portal_domain
```

`resolve_portal_domain()` 的顺序是：

```text
1. 尝试 service alias:
   request_host -> get_portal_subdomain_prefix()
   prefix -> portal_domain_aliases.prefix
   hit -> domain_type = service_alias

2. 如果 request_host 是 PORTAL_SERVICE_ROOT_DOMAIN 或其子域名:
   return None

3. 尝试 verified custom domain:
   request_host -> portal_custom_domains.domain
   hit and verified=True -> domain_type = custom

4. 都不命中:
   return None
```

命中后，middleware 先把解析结果写入 `request.portal_domain`。后续 view、模板和 URL 生成逻辑可以通过该字段知道当前请求绑定到哪个项目。

#### 9.7.4 请求上下文字段设计

middleware 只设置一个 request 字段：

```text
request.portal_domain
```

`request.portal_domain` 是统一的 Portal 域名解析结果。只要 Host 命中了 Portal 域名，不管是 service alias 还是 verified custom domain，都会设置该字段：

```text
request.portal_domain = {
    domain_type: "service_alias" | "custom",
    domain: resolved public domain,
    binding: resolved binding snapshot
}
```

用途：

- 后续 view 可以知道“这个请求已经通过 Portal 域名绑定到了某个 project”。
- 租户隔离校验统一读取 `portal_domain.binding.project_uuid`。
- 扁平 URL 判断应基于它，因为 service alias 和自有域名都使用扁平 Portal URL。
- `is_request_using_portal_domain(request, project_uuid)` 读取的是 `portal_domain.binding.project_uuid`。

`binding` 是解析函数从 manager/cache 返回的轻量绑定对象，不保证是完整 Django model instance。当前可读字段为：

```text
service_alias binding: prefix, project_uuid
custom binding: domain, project_uuid, verified
```

因此可以读取 `request.portal_domain.binding.project_uuid`。字段名是 `project_uuid`，不是 Django ORM lookup 写法 `project__uuid`。`request.portal_domain` 不再额外复制顶层 `project_uuid`，避免同一份项目归属在两个字段中重复维护。

如果后续逻辑需要判断当前 Host 是否是客户自有域名，直接判断：

```text
request.portal_domain.domain_type == "custom"
```

自有域名和 service alias 的解析结果都通过 `request.portal_domain.binding` 暴露。这样所有 Portal 域名上下文都集中在一个对象里，避免 view 和模板同时依赖两套 request 属性。

前端模板变量使用 `isPortalDomain`，实际赋值来自 `is_request_using_portal_domain()`，表示“当前请求是否使用 Portal 域名扁平 URL”，包含 service alias 和 verified custom domain。该变量不能只判断 `domain_type == "custom"`，否则 service alias 下的扁平 URL 会退化。

#### 9.7.5 Service alias canonical redirect

如果 Host 是 SeaTicket service alias，例如 `my-brand.seaticket-portal.ai`，middleware 会先处理 canonical redirect：

```text
if portal_domain.domain_type == "service_alias":
    requested_project_uuid = get_project_uuid_from_origin_path(normalized_path)
    binding_project_uuid = portal_domain.binding.project_uuid
    if requested_project_uuid and requested_project_uuid != binding_project_uuid:
        raise 404

    verified_custom_domain = PortalCustomDomain.objects.filter(
        project_uuid=binding_project_uuid,
        verified=True,
    ).first()

    if verified_custom_domain:
        redirect to request.scheme://verified_custom_domain.domain + request.get_full_path()
```

这里先检查路径里的显式 `project_uuid`。如果 URL 已经是标准 Portal/API/文件路径，且路径中的 `project_uuid` 与 service alias 绑定项目不一致，直接返回 404，防止用 A 项目的域名访问 B 项目的资源。

如果同项目已经有 verified custom domain，则 service alias 不再作为平级入口，而是 302 到客户自有域名。redirect 会保留原 path 和 query string，并使用 `request.scheme`，不硬编码 HTTPS。

这个 redirect 发生在 path rewrite 之前，所以 service alias 上的页面、API、文件路径和 preview 路径都会统一跳到 canonical custom domain。

#### 9.7.6 静态资源和基础资源透传

然后处理不应该被改写的基础资源：

```text
if normalized_path is static/auth/media pass-through path:
    pass through
```

这些路径直接交给原 URLConf 或静态资源处理：

```text
/accounts/
/captcha/
/custom-css/
/i18n/
/media/
/portal-preview/
/static/
```

这些资源不是某个扁平 Portal 页面本身。如果改写成 `/portal/<project_uuid>/...`，会破坏登录、验证码、静态资源、国际化资源和 preview token 页面。

#### 9.7.7 标准 Portal 路径校验和透传

接着判断当前路径是否已经是标准内部 Portal 路径：

```text
requested_project_uuid = get_project_uuid_from_origin_path(normalized_path)
binding_project_uuid = portal_domain.binding.project_uuid
if requested_project_uuid and requested_project_uuid != binding_project_uuid:
    raise 404

if requested_project_uuid and normalized_path is existing Portal API/file route:
    pass through
```

标准路径包括：

```text
/api/v1/portal/<project_uuid>/...
/file/portal/...
/upload-file/portal/...
/portal/<project_uuid>/...
/portal-external/...
```

如果路径里能解析出 `project_uuid`，它必须与 Host 绑定项目一致，否则 404。如果是同一项目的标准 Portal/API/文件路径，middleware 不改写，交给原 URLConf 处理。

#### 9.7.8 扁平路径改写

最后处理自定义域名或 service alias 下的扁平 Portal 页面路径：

```text
internal_path = get_internal_path_for_custom_domain(portal_domain.binding.project_uuid, normalized_path)
if internal_path is empty:
    raise 404

request.META["ORIGINAL_PATH_INFO"] = path
request.META["PATH_INFO"] = internal_path
request.path_info = internal_path
request.path = internal_path
pass through to Django URL resolver
```

支持的扁平路径和内部改写结果：

```text
/                               -> /portal/<project_uuid>/
/submit-issue/                  -> /portal/<project_uuid>/submit-issue/
/my-issues/                     -> /portal/<project_uuid>/my-issues/
/my-issues/<issue_id>/          -> /portal/<project_uuid>/my-issues/<issue_id>/
/knowledge-base/                -> /portal/<project_uuid>/knowledge-base/
/knowledge-base/<id>/           -> /portal/<project_uuid>/knowledge-base/<id>/
/chat/                          -> /portal/<project_uuid>/chat/
/chat/<session_uuid>/           -> /portal/<project_uuid>/chat/<session_uuid>/
/login/                         -> /portal/<project_uuid>/login/
/anonymous-validate/            -> /portal/<project_uuid>/anonymous-validate/
/logout/                        -> /portal-external/logout/<project_uuid>/
/external/accept/<token>/       -> /portal-external/accept/<token>/<project_uuid>/
```

不能匹配白名单的路径直接返回 404。这样不会把任意未知路径透传到 Portal 内部路由，避免 custom domain 扩大 URL surface。

Host 解析 helper：

- `get_request_host_without_port(request)` 先调用 `request.get_host()`，只捕获 `DisallowedHost`，失败时回退到 `HTTP_HOST` 或 `SERVER_NAME`。
- `get_host_without_port(host)` 去掉端口、转小写并去掉末尾 `.`。
- `resolve_portal_domain(host)` 先解析 service alias，再解析 verified custom domain。

路径识别 helper：

- `_get_project_uuid_from_origin_path(normalized_path)` 使用 Django `resolve()` 尝试从已有内部路由中提取 `project_uuid`。
- `_get_internal_path_for_portal_domain(project_uuid, normalized_path)` 只允许明确支持的扁平 Portal 页面路径，不能识别时返回空，由 middleware 返回 404。

Pass-through 路径汇总：

```text
/accounts/
/captcha/
/custom-css/
/i18n/
/media/
/portal-preview/
/static/
/api/v1/portal/<project_uuid>/...
/file/portal/...
/upload-file/portal/...
/portal/<project_uuid>/...
/portal-external/...
```

Redirect 优先于 path rewrite。也就是说，verified custom domain 存在时，Portal alias 上的页面、Portal API、文件路径和 preview 路径都会先跳转到 custom domain。

## 10. URL scheme 设计

Portal public URL 不硬编码 `https://`。

在有 request 的 API 中，使用当前请求 scheme：

```text
<request.scheme>://<domain>/<path>
```

覆盖范围：

- preview URL
- portal domain URL
- Portal alias 到 verified custom domain 的 302 redirect URL
- custom subdomain URL
- external invitation URL

这样本地开发可返回 `http://...`，生产在正确代理 HTTPS scheme 后返回 `https://...`。

部署要求：

- 如果 Django 位于反向代理后，需要正确传递协议头。
- Django 侧应按项目统一约定配置 `SECURE_PROXY_SSL_HEADER` 或等价代理设置，保证 `request.scheme` 准确。

API 返回和邮件发送中的 external invitation URL 使用 `PortalExternalInvitation.get_link(request, project)` 构造，调用方必须显式传入 request，以保证 Portal domain URL 使用当前请求 scheme；传入 project 后，历史已启用 Portal 但缺失 alias 的项目可以在生成邀请链接时补创建随机 alias。

## 11. API 设计

### 11.1 Get subdomain config

```text
GET /api/v1/portal/<:project_uuid>/domain-alias/
```

Sample Request:

```bash
curl --location 'http://127.0.0.1/api/v1/portal/3dd71ea8-0ec8-4541-80f4-f67987ff8439/domain-alias/' \
  -H 'Authorization: Token <YOUR_TOKEN>'
```

Sample Response:

```json
{
  "portal_service_root_domain": "ticket.ai",
  "default_subdomain_prefix": "test",
  "default_public_url": "https://test.ticket.ai/",
  "custom_subdomain_prefix": "test",
  "custom_public_url": "https://test.ticket.ai/"
}
```

Authentication:

- `TokenAuthentication` 或 `SessionAuthentication`
- `IsAuthenticated`
- `require_org_context`

示例中的 URL 假设当前请求 scheme 为 `https`。本地开发或 HTTP 入口下，后端会按 `request.scheme` 返回 `http://...`。

行为：

- 项目已启用 Portal 且 `PORTAL_SERVICE_ROOT_DOMAIN` 已配置时，如果 alias 缺失，会调用 `ensure_alias()` 创建随机 prefix 并返回。
- 项目未启用 Portal 时 alias 字段返回空，且不创建 alias。
- `default_subdomain_prefix` 和 `custom_subdomain_prefix` 都是当前 Portal service subdomain prefix。随机前缀和品牌前缀不是两条记录，而是同一条 `portal_domain_aliases.prefix` 在不同时刻的值。
- `default_public_url` 和 `custom_public_url` 都是按当前 request scheme 构造的 Portal public URL。
- `PORTAL_SERVICE_ROOT_DOMAIN` 未配置时，不补创建 alias；如果已有 alias，prefix 仍可返回，但 public URL 返回空。

算法：

```text
project = get project by project_uuid
root_domain = PORTAL_SERVICE_ROOT_DOMAIN
enable_portal = project.settings.portal.enable_portal

alias = None
if enable_portal:
    alias = PortalDomainAlias.objects.filter(project_uuid=project_uuid).first()
    if alias is None and root_domain:
        alias = PortalDomainAlias.objects.ensure_alias(project_uuid)

prefix = alias.prefix if alias else ""
domain = build_portal_service_domain(prefix) if root_domain and prefix else ""
public_url = build_absolute_portal_url(request, domain)

return portal_service_root_domain/default_*/custom_* from prefix/public_url
```

这个 GET 接口虽然会在特定条件下写入 alias，但写入范围只限于“Portal 已启用、root domain 已配置、alias 缺失”的历史数据补齐场景。它不会为未启用 Portal 的项目开通新入口。

### 11.2 Update subdomain config

```text
POST /api/v1/portal/<:project_uuid>/domain-alias/
```

请求：

```json
{
  "custom_subdomain_prefix": "my-brand"
}
```

认证：

- 登录用户
- org context
- project admin

行为：

- 空字符串重置为新的随机 prefix。
- 非空时创建或更新当前 alias。
- root domain 未配置时返回 400。

错误：

| 状态码 | 场景 |
| --- | --- |
| 400 | prefix 无效、保留、已被占用、root domain 未配置 |
| 403 | 非 project admin |
| 404 | project 不存在 |

### 11.3 读取自有域名配置

```text
GET /api/v1/portal/<project_uuid>/custom-domain/
```

返回：

```json
{
  "custom_domain": "support.customer.com",
  "custom_domain_verified": true,
  "custom_domain_verified_at": "2026-06-25T10:00:00+08:00",
  "custom_domain_txt_record_name": "_seaqa-portal-challenge.support.customer.com",
  "custom_domain_txt_record_value": "seaqa-portal-verification=<token>",
  "custom_domain_dns_target": "custom-domains.seaticket-portal.ai"
}
```

### 11.4 更新自有域名

```text
POST /api/v1/portal/<project_uuid>/custom-domain/
```

请求：

```json
{
  "custom_domain": "support.customer.com"
}
```

认证：

- 登录用户
- org context
- project admin

行为：

- 空字符串删除绑定。
- 新域名创建绑定。
- 修改域名会重置验证状态。

### 11.5 验证自有域名

```text
POST /api/v1/portal/<project_uuid>/custom-domain/verify/
```

认证：

- 登录用户
- org context
- project admin

行为：

- 查询 DNS TXT。
- 匹配 token 后标记 `verified=True`。

### 11.6 创建预览 token

```text
POST /api/v1/portal/<project_uuid>/preview-token/
```

认证：

- 登录用户
- org context
- project admin

返回：

```json
{
  "token": "<signed-token>",
  "preview_url": "https://my-brand.seaticket-portal.ai/portal-preview/<token>/"
}
```

preview URL 优先级：

1. verified custom domain
2. portal alias
3. 当前请求 host 的 `request.build_absolute_uri()`

Token：

- 使用 Django signing。
- salt：`seahub.portal.preview`
- TTL：5 分钟。

### 11.7 TLS ask

```text
GET /internal/portal/custom-domain/allow-tls?domain=<domain>
```

调用方：

- Caddy On-Demand TLS。

认证：

- 无用户认证。
- 使用 throttle：`portal_tls_ask`。

返回：

| 状态码 | 含义 |
| --- | --- |
| 200 | domain 存在且 `verified=True` |
| 403 | domain 无效、不存在、未验证 |
| 429 | throttle 命中 |

算法：

```text
domain = normalize_portal_custom_domain(request.GET["domain"])
cache_key = portal_tls_ask_allowed:<domain>

if cache hit:
    return 200 if cached True else 403

binding = PortalCustomDomain.objects.get_by_domain(domain)
allowed = bool(binding and binding.verified)
cache.set(cache_key, allowed, 60s)
return 200 if allowed else 403
```

## 12. Caddy and TLS

### 12.1 Caddy 模板

`deploy/caddy/portal.Caddyfile.template`：

```caddyfile
{
    email {$ACME_EMAIL}

    on_demand_tls {
        ask http://{$PORTAL_UPSTREAM}/internal/portal/custom-domain/allow-tls
    }
}

{$SEATICKET_SERVER_HOSTNAME} {
    reverse_proxy {$MAIN_UPSTREAM}
}

{$PORTAL_SERVICE_ROOT_DOMAIN}, *.{$PORTAL_SERVICE_ROOT_DOMAIN} {
    tls {
        dns cloudflare {$CLOUDFLARE_API_TOKEN}
    }

    @internal path /internal/*
    respond @internal 404

    reverse_proxy {$PORTAL_UPSTREAM}
}

https:// {
    tls {
        on_demand
    }

    @internal path /internal/*
    respond @internal 404

    reverse_proxy {$PORTAL_UPSTREAM}
}
```

### 12.2 证书策略

| 域名类型 | 证书策略 |
| --- | --- |
| `*.PORTAL_SERVICE_ROOT_DOMAIN` | 通配符证书，DNS challenge |
| 客户自有域名 | On-Demand TLS，ask 通过后申请 |
| 主站域名 | 常规证书 |

平台随机域名和品牌域名都只是 `PORTAL_SERVICE_ROOT_DOMAIN` 下的一级子域名。用户保存 prefix 后，后端只写入或更新 `portal_domain_aliases.prefix`，不为该 prefix 单独申请证书：

```text
prefix = x765cd
domain = x765cd.PORTAL_SERVICE_ROOT_DOMAIN
```

`normalize_portal_subdomain_prefix()` 只允许单个 DNS label，不允许 `.`，因此不会产生 `a.b.PORTAL_SERVICE_ROOT_DOMAIN` 这种通配符证书覆盖不到的多级子域名。

平台侧一次性配置以下 DNS 和 Caddy TLS 后，所有随机域名和品牌域名都由同一张 wildcard 证书覆盖：

```text
PORTAL_SERVICE_ROOT_DOMAIN      -> Caddy portal entrypoint
*.PORTAL_SERVICE_ROOT_DOMAIN    -> Caddy portal entrypoint
```

例如：

```text
ticket-portal.seafile.com       -> Caddy portal entrypoint
*.ticket-portal.seafile.com     -> Caddy portal entrypoint
```

客户自有域名不走 wildcard 证书。它必须先完成 TXT 所有权验证并设置 CNAME，之后由 Caddy On-Demand TLS 通过 ask 接口确认 `verified=True` 后自动申请证书。

### 12.3 Caddy 安全建议

TLS ask 接口必须能被 Caddy 调用。推荐部署层做以下限制：

- Caddy public site block 对 `/internal/*` 返回 404，避免外部直接访问内部接口。
- Caddy ask URL 使用 `http://{$PORTAL_UPSTREAM}/internal/portal/custom-domain/allow-tls`，通过内部 upstream 调用，不依赖公网路径。
- 如果生产网络支持，应进一步只允许 Caddy 内网访问 Portal upstream 的 `/internal/*`。
- 保留应用层 throttle，防止异常流量打穿 DB。
- 配置 Caddy on-demand TLS 的全局限制策略，避免任意域名触发证书申请风暴。

## 13. 安全设计

### 13.1 攻击面隔离

Portal mode 使用独立 URLConf，只暴露：

- Portal 页面。
- Portal API。
- Portal 文件访问。
- 外部登录/邀请路径。
- TLS ask endpoint。

管理后台相关路由不在 Portal mode 暴露。

### 13.2 Cookie and session 隔离

主站域名和 Portal 域名不同：

```text
seaticket.ai
seaticket-portal.ai
support.customer.com
```

浏览器天然按域隔离 cookie。主站 session 不直接复用到客户域名。

### 13.3 CSRF

Main mode：

```python
CSRF_TRUSTED_ORIGINS = ["https://*", "http://*"]
```

这是当前主站兼容配置，不是 Portal 自定义域名所需的信任策略。后续如果要收紧主站 CSRF 信任边界，应该把它改为明确的主站域名和管理端需要的固定 origin。

Portal mode：

```python
CSRF_TRUSTED_ORIGINS = []
django.middleware.csrf.CsrfViewMiddleware
```

Portal mode 使用 Django 标准 CSRF origin 校验，不额外放行同项目跨域 origin。当前 canonical 策略会在 verified custom domain 存在时把 Portal alias 302 到 custom domain，正常写请求应发生在同一个浏览器 origin 下：

```text
Origin: https://support.customer.com
Host:   support.customer.com
```

同 project 跨域写请求不再被特殊放行：

```text
Origin: https://my-brand.seaticket-portal.ai
Host:   support.customer.com
```

### 13.4 租户隔离

Host 解析后通过 `request.portal_domain.binding.project_uuid` 得到绑定项目。middleware 对显式带 project uuid 的 URL 做一致性校验：

```text
requested_project_uuid != portal_domain.binding.project_uuid -> 404
```

这样避免用一个项目域名访问另一个项目的 Portal API 或页面。

### 13.5 所有权验证

自有域名必须通过 DNS TXT 验证后才能：

- 被 Portal middleware 解析。
- 被 TLS ask endpoint 返回 200。
- 作为 preview URL 的优先域名。
- 成为 Portal alias 的 canonical redirect 目标。

### 13.6 保留域名和前缀

系统拒绝：

- 主站域名作为 custom domain。
- Portal 根域和其子域名作为 custom domain。
- 保留前缀作为 Portal alias。
- `PORTAL_CUSTOM_DOMAIN_DNS_TARGET` 的前缀作为 Portal alias。

## 14. 前端交互

Portal 设置页通过三个接口加载：

```text
GET /api/v1/portal/<project_uuid>/settings/
GET /api/v1/portal/<project_uuid>/custom-domain/
GET /api/v1/portal/<project_uuid>/domain-alias/
```

在 edit portal 页面点击 Settings 打开设置弹窗时，`Settings` 组件会加载 domain alias 配置。对于历史已启用 Portal 但缺少随机 alias 的项目，这次 `GET /domain-alias/` 会触发后端 `ensure_alias()`，创建随机 prefix 并把 `default_public_url` 返回给前端。

加载时序：

```text
Click Settings in edit portal
  -> mount Settings component
  -> load portal settings
  -> load custom domain settings
  -> load domain alias settings
       -> GET /api/v1/portal/<project_uuid>/domain-alias/
       -> backend may ensure random alias
       -> frontend applies default_public_url/custom_subdomain_prefix
```

这保证了历史项目即使不是通过“重新保存 Portal settings”触发，也能在管理员实际打开设置页时得到随机 Portal domain。

Custom domain tab 显示：

- Portal domain：来自 `default_public_url`。
- Custom subdomain：输入 prefix，后缀来自 `portal_service_root_domain`。
- Custom subdomain URL：来自 `custom_public_url`。
- Custom domain：客户自有域名输入。
- TXT record name/value。
- DNS target。

显示条件：

```javascript
(domainAliasRoot || defaultDomainPublicUrl)
```

因此后端必须返回 `portal_service_root_domain`，否则 Portal domain 区域不会显示。

URL 拼接：

- 前端不自行推导服务子域名 URL，使用后端返回的 `default_public_url` 和 `custom_public_url`。
- 普通 `/portal/<project_uuid>/` fallback URL 使用 `window.location.origin`。

Portal 页面运行时模板变量：

```javascript
window.app.pageOptions = {
  isPortalDomain: true | false,
  portalBaseUrl: "/" | "/portal/<project_uuid>" | "/portal-edit/<project_uuid>",
}
```

含义：

- `isPortalDomain` 表示当前请求是否通过 Portal 域名访问，包含 service alias 和 verified custom domain。
- `isPortalDomain` 为 `true` 且不是 edit mode 时，前端路由基于 `portalBaseUrl` 生成扁平 URL，例如 `/my-issues/`。
- `isPortalDomain` 为 `false` 时，前端回退到标准路径 `/portal/<project_uuid>/...`。
- edit mode 始终使用 `/portal-edit/<project_uuid>/...`，不使用 Portal 域名扁平 URL。

## 15. 运维流程

### 15.1 启用 Portal

1. 管理员在项目设置中启用 Portal。
2. Main mode 更新 project settings。
3. 初始化 Portal issue 表。
4. 如果 `PORTAL_SERVICE_ROOT_DOMAIN` 已配置，创建 Portal alias。
5. 前端读取 domain alias 配置，显示 Portal domain。

如果项目是历史数据，Portal 已启用但缺少 alias，则管理员在 edit portal 页面打开 Settings 时也会读取 domain alias 配置，并自动补创建随机 alias。

### 15.2 配置 Portal alias

1. 管理员输入 prefix。
2. 后端校验 prefix。
3. 写入或更新 `portal_domain_aliases.prefix`。
4. Portal mode 通过 Host 解析到项目。

DNS 前提：

```text
*.PORTAL_SERVICE_ROOT_DOMAIN -> Caddy portal entrypoint
```

只要平台侧已经配置 wildcard DNS 和 wildcard TLS，管理员保存 prefix 后即可通过该平台子域名访问 Portal，不需要为每个随机 prefix 或品牌 prefix 单独配置 DNS 或证书。

### 15.3 配置 custom domain

1. 管理员输入 `support.customer.com`。
2. 后端创建 `portal_custom_domains`，返回 TXT name/value。
3. 用户在 DNS 服务商配置：

```text
CNAME support.customer.com -> PORTAL_CUSTOM_DOMAIN_DNS_TARGET
TXT _seaqa-portal-challenge.support.customer.com = seaqa-portal-verification=<token>
```

4. 管理员点击 Verify。
5. 验证通过后 Caddy 首次 HTTPS 访问会通过 TLS ask 申请证书。
6. 验证通过后，通过 Portal alias 访问同项目时会 302 redirect 到 custom domain。

### 15.4 停用 Portal

Portal 是否启用由 project settings 控制。停用 Portal 不删除 alias 或 custom domain 记录。

访问已停用 Portal 时，Portal view 会返回 `Portal is not enabled`。

## 16. 迁移和兼容性

### 16.1 新部署

`sql/mysql.sql` 中 `portal_domain_aliases` 不包含 `enabled` 和 `alias_type` 字段。`project_uuid` 是唯一键，一个项目只有一条 Portal alias。

### 16.2 已有部署

如果数据库已经有 `portal_domain_aliases.enabled`：

- Django model 不再使用该列。
- 该列存在不会影响 Django 读写。
- 如需清理，可执行 DDL：

```sql
ALTER TABLE portal_domain_aliases DROP COLUMN enabled;
```

如果数据库已经有 `portal_domain_aliases.alias_type`，需要先做数据合并再删除字段：

- 同一个 `project_uuid` 只有一条记录时，直接保留该记录。
- 同一个 `project_uuid` 同时存在 `default` 和 `custom` 时，保留用户配置过的 `custom` prefix，删除旧随机 `default` 记录。
- 合并完成后再删除 `alias_type` 并添加 `project_uuid` 唯一键。

示例 DDL：

```sql
ALTER TABLE portal_domain_aliases DROP INDEX portal_domain_aliases_project_type_uniq;
ALTER TABLE portal_domain_aliases DROP COLUMN alias_type;
ALTER TABLE portal_domain_aliases ADD UNIQUE KEY portal_domain_aliases_project_uuid_uniq (project_uuid);
```

执行上述 DDL 前必须确认没有重复 `project_uuid`，否则唯一键添加会失败。

### 16.3 历史项目 Portal alias 缺失

历史已启用 Portal 但缺少 alias 的项目，在读取 domain alias 配置时会自动补创建随机 prefix：

```json
{
  "default_subdomain_prefix": "x765cd",
  "default_public_url": "https://x765cd.seaticket-portal.ai/"
}
```

触发条件：

- 项目 Portal 已 enabled。
- `PORTAL_SERVICE_ROOT_DOMAIN` 已配置。
- 当前项目没有 `portal_domain_aliases` 记录。

如果需要批量提前修复历史数据，也可以一次性调用 `PortalDomainAlias.objects.ensure_alias(project_uuid)`。

## 17. 测试设计

### 17.1 单元测试覆盖点

项目更新：

- Portal 从 disabled 切到 enabled 时创建 Portal alias。
- Portal 已 enabled 但缺 alias 时，保存 Portal settings 或读取 domain alias 配置会补创建 alias。

Domain alias API：

- 返回已有 Portal alias。
- Portal enabled 且缺 Portal alias 时创建随机 prefix 并返回。
- Portal disabled 时不创建 Portal alias。
- 创建或更新 Portal alias。
- 空 prefix 重置为新的随机 Portal alias。
- 拒绝其他项目已使用的 prefix。
- root domain 未配置时拒绝创建、更新或重置 Portal alias。
- 拒绝保留 prefix、过短 prefix、DNS target prefix。
- root domain 未配置时不返回 custom public URL。

Preview token：

- verified custom domain 优先。
- portal alias 次优先。
- Portal disabled 时不创建 Portal alias。
- root domain 未配置时不使用 alias，避免坏 URL。

Custom domain API：

- 创建、替换、删除。
- 替换时重置验证状态。
- 拒绝其他项目已使用的 domain。
- 拒绝 Portal 服务子域名。
- 删除时清理 TLS ask cache。

TLS ask：

- verified custom domain 返回 200。
- unverified/missing/invalid domain 返回 403。
- 使用 throttle scope `portal_tls_ask`。
- negative cache 在 domain 创建后失效。
- 非本地来源也按 DB 验证结果处理。

Middleware and CSRF：

- custom domain root path rewrite。
- service alias root path rewrite。
- service alias 在 verified custom domain 存在时 302 redirect 到 custom domain。
- unverified custom domain 不触发 service alias redirect。
- mismatched project uuid 返回 404。
- middleware 只设置 `request.portal_domain`，不再设置单独的 custom-domain request 字段。
- `request.portal_domain.binding.project_uuid` 在 service alias 和 verified custom domain 场景均可读取。
- Portal view context 使用 `is_portal_domain`，模板 pageOptions 使用 `isPortalDomain`，不再暴露旧的 custom-domain 命名。
- Portal mode 使用标准 CSRF same-origin 校验，不放行同 project 跨域写请求。

### 17.2 手工测试清单

1. 启用 Portal 后确认数据库生成一条 `portal_domain_aliases`。
2. 设置页显示 Portal domain。
3. 本地 http 环境返回 `http://...` public URL。
4. HTTPS 环境返回 `https://...` public URL。
5. Portal alias 保存后可以通过 `my-brand.<root>` 访问。
6. custom domain TXT 验证通过后，Caddy 首次访问能申请证书。
7. Portal mode 下主站管理路由不可访问。
8. 不同项目域名不能访问彼此项目 API。

## 18. 监控和日志

建议监控：

- TLS ask 2xx/4xx/429 数量。
- DNS TXT 验证失败数量。
- `ensure_alias()` IntegrityError 重试数量。
- domain alias 创建冲突数量。
- Caddy on-demand TLS 申请失败数量。

建议日志：

- 自有域名绑定、删除、验证成功。
- TLS ask 拒绝原因，注意不要输出敏感 token。
- Host 解析失败可低频采样记录，避免噪音。

## 19. 风险和缓解

| 风险 | 缓解 |
| --- | --- |
| 任意域名触发 On-Demand TLS | Caddy ask + DB verified 检查 + throttle + Caddy on-demand 限制 |
| 历史项目缺 Portal alias | domain alias 读取接口自动回填，必要时也可运行数据修复脚本 |
| 反向代理未传 HTTPS scheme | 配置代理头和 Django secure proxy 设置 |
| DNS TXT 传播延迟 | 前端允许重复 Verify，后端 DNS 查询失败返回明确错误 |
| 缓存导致短时间结果不一致 | custom domain save/delete 清理 domain cache 和 TLS ask cache |
| prefix 抢占 | DB 唯一键 + 应用层检查 + IntegrityError 兜底 |

## 20. 未来扩展

- 增加 Portal alias 数据修复管理命令。
- 增加更严格的 Caddy/IP 级 `/internal/*` allowlist 示例。
- 增加 domain alias/custom domain 配置审计日志。
- 增加管理端批量查看域名绑定和证书状态能力。
