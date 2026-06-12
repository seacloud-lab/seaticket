# Portal Custom Domain Design

## 1. 背景和目标

Portal 需要支持客户绑定自己的自有域名，例如 `support.example.com`，使外部用户可以通过客户域名访问对应项目的 Portal。

本设计参考 GitHub Pages 的自定义域名模式：

1. 用户在产品内保存自定义域名。
2. 系统生成 DNS TXT 验证记录，证明用户拥有该域名。
3. 用户在 DNS 服务商处配置解析和 TXT 记录。
4. 用户回到产品内点击验证。
5. 验证通过后，该域名才会生效并路由到对应 Portal。
6. 网关层自动签发或加载 TLS 证书，使 HTTPS 可访问。

核心目标：

- 防止未验证域名保存后立即生效，避免域名抢占和 Host 劫持风险。
- 用户侧只需要配置 DNS，不需要接触服务器配置。
- 线上证书签发和续期尽量自动化，避免每个域名人工处理。
- 应用层只处理域名绑定、权属验证和 Portal 路由；TLS 由网关层处理。

## 2. 范围

本功能覆盖：

- 每个 Portal 绑定一个自定义域名。
- 自定义域名唯一，不能被多个 Portal 复用。
- 保存域名后生成 TXT challenge。
- 只有 TXT 验证通过的域名才允许访问 Portal。
- Portal 前端路由在自定义域名下使用根路径，例如 `/`、`/chat/`、`/my-issues/`。
- SQL 建表语句已补充到 `sql/mysql.sql`。

本功能不覆盖：

- 数据库迁移脚本，由运维或迁移流程单独处理。
- 在 Django 内部处理 TLS 证书。
- 手动为每个客户域名配置 Nginx server block。
- 支持一个 Portal 多个自定义域名。

## 3. 术语

- 自定义域名：客户自己的域名，例如 `support.example.com`。
- DNS target：平台提供给客户配置 CNAME/ALIAS 的目标，例如 `portal.seaqa.example.com`。
- TXT challenge：平台生成的 DNS TXT 记录，用于证明客户拥有该域名。
- Portal ingress：线上接收 Portal 域名流量的网关，可以是 Caddy、Nginx Ingress、Load Balancer 或 CDN。
- Verified domain：TXT 验证通过、允许生效的自定义域名。

## 4. 用户侧配置流程

用户在产品内看到的流程应为：

1. 进入项目 Portal 设置页。
2. 在 `Custom domain` 输入框填写域名，例如：

   ```text
   support.example.com
   ```

3. 点击保存。
4. 系统展示 DNS 配置说明：

   流量解析记录：

   ```text
   Type: CNAME
   Name: support
   Value: portal.seaqa.example.com
   ```

   权属验证记录：

   ```text
   Type: TXT
   Name: _seaqa-portal-challenge.support.example.com
   Value: seaqa-portal-verification=<token>
   ```

5. 用户到 DNS 服务商控制台添加上述记录。
6. 等待 DNS 生效。
7. 回到 Portal 设置页点击 `Verify`。
8. 验证成功后，系统显示域名已验证，并展示可访问地址：

   ```text
   https://support.example.com/
   ```

## 5. DNS 配置说明

### 5.1 子域名推荐使用 CNAME

推荐客户绑定子域名，例如：

```text
support.example.com
help.example.com
portal.example.com
```

客户 DNS 侧配置：

```text
Type: CNAME
Name: support
Value: portal.seaqa.example.com
TTL: 300 或默认值
```

注意：

- `Value` 只填写域名，不包含 `https://`。
- 不填写路径，例如不能写 `portal.seaqa.example.com/portal/xxx/`。
- 不填写端口。
- DNS target 由服务端配置项 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET` 提供给前端展示。

### 5.2 根域名使用 ALIAS/ANAME 或 A 记录

如果客户希望绑定根域名：

```text
example.com
```

标准 DNS 不允许根域名直接配置 CNAME。此时有三种选择：

1. DNS 服务商支持 ALIAS/ANAME：配置到 `portal.seaqa.example.com`。
2. 使用 A/AAAA 记录：指向我们 Portal ingress 的固定公网 IP。
3. 建议客户改用子域名，例如 `support.example.com`。

MVP 建议只在产品说明中推荐子域名 CNAME。根域名可作为后续增强场景处理。

### 5.3 TXT 验证记录

保存自定义域名后，系统生成：

```text
Name: _seaqa-portal-challenge.<custom-domain>
Value: seaqa-portal-verification=<verification-token>
```

例如客户绑定 `support.example.com`：

```text
Type: TXT
Name: _seaqa-portal-challenge.support.example.com
Value: seaqa-portal-verification=9f1a...
```

验证接口会查询该 TXT 记录，只有完全匹配期望值时才标记为 verified。

### 5.4 CDN 代理注意事项

如果客户使用 Cloudflare 等 CDN：

- TXT 验证不受 CDN 代理影响。
- CNAME 流量解析如果开启代理，TLS 可能在 CDN 侧终止。
- MVP 建议提示客户先使用 DNS only 模式，等平台证书签发完成后再开启代理。
- 如果客户坚持使用 CDN 代理，需要确保 CDN 到源站的 Host、SNI、HTTPS 模式正确，否则可能出现 525/526 或 Host 路由失败。

## 6. 应用层设计

### 6.1 数据模型

表：`portal_custom_domains`

字段：

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

约束：

- `domain` 唯一，防止同一个域名绑定到多个 Portal。
- `project_uuid` 唯一，当前设计为一个 Portal 只能绑定一个自定义域名。
- `verified = 1` 时才允许该域名作为访问入口。

### 6.2 域名保存

域名配置使用独立接口，不与 Portal 其他设置混在 `/settings/` 中提交。

读取接口：

```text
GET /api/v1/portal/<project_uuid>/custom-domain/
```

返回当前绑定、TXT 验证信息和可访问 URL：

```json
{
  "custom_domain": "support.example.com",
  "custom_domain_verified": false,
  "custom_domain_verified_at": null,
  "custom_domain_txt_record_name": "_seaqa-portal-challenge.support.example.com",
  "custom_domain_txt_record_value": "seaqa-portal-verification=<token>",
  "custom_domain_dns_target": "portal.seaqa.example.com"
}
```

保存接口：

```text
POST /api/v1/portal/<project_uuid>/custom-domain/
```

请求包含：

```json
{
  "custom_domain": "support.example.com"
}
```

处理逻辑：

1. 校验项目存在。
2. 校验当前用户是项目管理员。
3. 规范化域名：
   - 转小写。
   - 不允许 scheme，例如 `https://`。
   - 不允许 path、query、fragment。
   - 不允许 port。
   - 必须是完整域名。
   - 不允许保留域名，例如服务自身域名。
4. 检查域名是否已被其他项目绑定。
5. 新建或更新 `portal_custom_domains`。
6. 如果域名发生变化，重置验证状态：
   - 生成新的 `verification_token`。
   - `verified = false`。
   - `verified_at = null`。
7. 如果提交空字符串，删除当前项目的自定义域名绑定。

保存成功不代表域名可访问。

### 6.3 验证域名

接口：

```text
POST /api/v1/portal/<project_uuid>/custom-domain/verify/
```

处理逻辑：

1. 校验项目存在。
2. 校验当前用户是项目管理员。
3. 查询当前项目绑定的自定义域名。
4. 生成待查询 TXT record name：

   ```text
   _seaqa-portal-challenge.<domain>
   ```

5. 生成期望 TXT value：

   ```text
   seaqa-portal-verification=<verification-token>
   ```

6. 使用 DNS resolver 查询 TXT。
7. 如果匹配，更新：

   ```text
   verified = true
   verified_at = now()
   ```

8. 如果不匹配，返回错误：

   ```text
   TXT record not found or invalid.
   ```

### 6.4 Host 路由

中间件在请求进入 URL routing 前处理：

1. 读取请求 Host，不包含 port。
2. 根据 Host 查询 `portal_custom_domains`。
3. 只有存在且 `verified = true` 才继续处理。
4. 如果请求路径中显式包含 `project_uuid`，必须与该 Host 绑定的 `project_uuid` 一致；不一致直接返回 404。

   需要检查的路径包括：

   ```text
   /portal/<project_uuid>/...
   /portal-edit/<project_uuid>/...
   /api/v1/portal/<project_uuid>/...
   /portal-external/logout/<project_uuid>/
   /portal-external/accept/<token>/<project_uuid>/
   /upload-file/portal/<project_uuid>/...
   /file/portal/<project_uuid>/...
   ```

   这样可以防止客户 A 的自定义域名被当成客户 B Portal 或 Portal API 的入口。

5. 将自定义域名根路径下的 Portal 页面路径映射到内部标准 Portal 路径：

   ```text
   /                         -> /portal/<project_uuid>/
   /submit-issue/            -> /portal/<project_uuid>/submit-issue/
   /chat/                    -> /portal/<project_uuid>/chat/
   /chat/<session_uuid>/     -> /portal/<project_uuid>/chat/<session_uuid>/
   /my-issues/               -> /portal/<project_uuid>/my-issues/
   /my-issues/<issue_id>/    -> /portal/<project_uuid>/my-issues/<issue_id>/
   /knowledge-base/          -> /portal/<project_uuid>/knowledge-base/
   /knowledge-base/<id>/     -> /portal/<project_uuid>/knowledge-base/<id>/
   /login/                   -> /portal/<project_uuid>/login/
   /anonymous-validate/      -> /portal/<project_uuid>/anonymous-validate/
   /logout/                  -> /portal-external/logout/<project_uuid>/
   /external/accept/<token>/ -> /portal-external/accept/<token>/<project_uuid>/
   ```

6. 对同一 `project_uuid` 的标准 Portal/API/文件路径，不做路径改写。
7. 对 Portal 页面依赖的静态资源、登录资源和国际化资源允许透传，例如 `/static/`、`/media/`、`/custom-css/`、`/accounts/`、`/captcha/`、`/i18n/`。
8. 对命中的自定义域名请求设置 `request.portal_custom_domain`，供后续 URL 构造使用。
9. 对 verified 自定义 Host 下无法识别的路径直接返回 404，不回退到主站路由。

未验证域名不会触发该映射。

### 6.5 URL 生成

标准 Portal URL：

```text
https://service.example.com/portal/<project_uuid>/
```

已验证自定义域名 URL：

```text
https://support.example.com/
```

规则：

- 默认 Portal URL 不属于域名配置，由普通 Portal 页面路径或前端页面上下文生成。
- `custom-domain/` 接口只返回自定义域名绑定、验证状态、DNS target 和 TXT 验证信息。
- 已验证自定义域名的展示 URL 由前端根据已保存域名拼出，例如 `https://support.example.com/`。
- 邀请链接只有在自定义域名已验证后才使用自定义域名。
- 标准域名邀请链接使用 `/portal-external/accept/<token>/<project_uuid>/`。
- 自定义域名邀请链接使用 `/external/accept/<token>/`，项目归属由 Host 绑定关系决定。
- 前端设置页只有在自定义域名已验证后才展示可复制的自定义域名访问 URL。

## 7. 关键算法设计

本节描述需要保持稳定的核心处理逻辑。每个算法重点说明“先做什么、再做什么、为什么这么做、失败时如何处理”。具体代码实现可以调整，但输入输出、判断顺序和安全边界不应变化。

### 7.1 域名规范化和合法性校验算法

目标是把用户输入统一成唯一、可比较、可入库的域名格式，并在保存前排除明显不安全或无法路由的输入。

处理步骤：

1. 先对用户输入执行 `trim` 和小写转换。

   原因是 DNS 域名本身大小写不敏感，`Support.Example.com` 和 `support.example.com` 应被视为同一个域名。先统一格式可以避免同一个域名因为大小写差异绕过唯一性校验。

2. 检查输入是否为空。

   如果是保存接口，空字符串表示用户希望解绑当前自定义域名；如果是查询或验证流程，空值应直接视为无效输入。这样可以明确区分“删除绑定”和“保存非法域名”。

3. 拒绝包含 scheme、路径、query、fragment 的输入。

   例如 `https://support.example.com`、`support.example.com/path`、`support.example.com?x=1` 都应拒绝。原因是 DNS 只能配置域名，不能配置 URL。应用层路由只依赖 Host，不应该把路径或协议混入域名字段。

4. 去掉域名末尾的点。

   DNS 中 `support.example.com.` 是 fully qualified domain name 的标准写法，但产品内展示和数据库保存应使用 `support.example.com`。去掉末尾点可以避免同一个域名保存成两种形式。

5. 对国际化域名执行 IDNA 编码。

   例如中文域名或包含非 ASCII 字符的域名，需要转换成 punycode 形式后再入库和比较。这样可以保证数据库里只保存 ASCII 域名，后续 Host 匹配和 DNS 查询更稳定。

6. 拒绝包含端口的输入。

   例如 `support.example.com:8080` 应拒绝。端口属于访问 URL，不属于 DNS 域名。自定义域名绑定的粒度是 Host，不包含 port。

7. 校验整体长度、label 数量和每个 label 的格式。

   域名总长度不能超过 253，每个 label 只能包含小写字母、数字和横线，且不能以横线开头或结尾。至少需要两个 label，例如 `example.com`；单个 `localhost` 不应作为客户自定义域名。

8. 拒绝最后一个 label 为纯数字的域名。

   这样可以排除类似 IP 地址或明显不合规的输入，避免后续 Host 解析歧义。

9. 检查保留域名列表。

   保留域名至少应包含平台主服务域名、Portal ingress 目标域名、内部域名和本地测试域名。客户不能把平台自身域名或入口域名绑定到某个项目，否则会破坏主站访问或造成路由歧义。

输出结果：

```text
输入：HTTPS://Support.Example.com./path
结果：拒绝，因为包含 scheme 和 path

输入：Support.Example.com.
结果：support.example.com

输入：portal.seaqa.example.com
结果：如果该域名是 PORTAL_CUSTOM_DOMAIN_DNS_TARGET，则拒绝
```

复杂度：

- 时间复杂度 `O(n)`，`n` 为域名长度。
- 空间复杂度 `O(n)`。

### 7.2 域名绑定保存和验证状态重置算法

目标是保证域名绑定关系唯一、可验证、可撤销，并且任何域名变更都必须重新完成权属验证。

处理步骤：

1. 先校验项目是否存在。

   自定义域名绑定在项目 Portal 上，如果项目不存在，后续查重和入库都没有意义，应直接返回 `404`。

2. 再校验当前用户是否是项目管理员。

   保存或删除自定义域名会影响外部用户访问入口，必须限制为项目管理员操作。普通成员或外部用户不能修改域名绑定。

3. 对输入域名执行规范化和合法性校验。

   保存前必须统一格式，避免后续唯一性校验失效。规范化失败时直接返回 `400`，错误信息应能指导用户删除 scheme、路径或端口。

4. 如果规范化结果为空，删除当前项目已有绑定。

   这表示用户主动解绑自定义域名。解绑后该域名不再命中 Host 路由，邀请链接也应回退到标准 Portal 地址。

5. 查询该域名是否已被其它项目绑定。

   如果已被其它项目绑定，应拒绝保存。原因是 Host 只能路由到一个项目，如果同一域名允许绑定多个项目，请求进入时无法判断归属。

6. 查询当前项目是否已有绑定记录。

   如果没有记录，则创建新记录，生成新的 `verification_token`，并设置 `verified = false`。

7. 如果已有记录且域名没有变化，只保存必要字段，不重置 token 和 verified 状态。

   这样可以避免用户重复点击保存后 TXT 记录失效。只要域名没变，原 verification token 和验证结果仍然有效。

8. 如果已有记录但域名发生变化，必须重置验证状态。

   需要生成新的 `verification_token`，设置 `verified = false`，清空 `verified_at`。原因是旧域名的 TXT 记录不能证明用户拥有新域名。

9. 最后依赖数据库唯一索引兜底。

   应用层查重不能完全解决并发提交问题。`domain` 唯一索引用于防止两个项目同时绑定同一域名，`project_uuid` 唯一索引用于防止一个项目出现多条绑定。

失败处理：

```text
项目不存在 -> 404
非项目管理员 -> 403
域名格式非法 -> 400
域名已被其它项目绑定 -> 400
数据库唯一约束冲突 -> 转换为可读的 domain already in use
```

### 7.3 TXT challenge 生成算法

目标是生成一组只能由域名所有者配置成功的 DNS TXT 记录，用于证明用户对该域名有控制权。

处理步骤：

1. 在创建绑定记录或域名发生变化时生成随机 token。

   token 应使用安全随机数，例如 `token_hex(16)`。不要使用项目 ID、域名 hash、时间戳这类可预测值。原因是 TXT 验证的核心是不可伪造，token 可预测会降低验证意义。

2. 使用固定前缀生成 TXT record name。

   规则是：

```text
_seaqa-portal-challenge.<custom-domain>
```

   例如绑定 `support.example.com`，系统查询 `_seaqa-portal-challenge.support.example.com`。选择独立 challenge 子域名是为了避免和客户已有 `support.example.com` 的业务 TXT 记录混在一起，也避免影响 CNAME 记录。

3. 使用固定前缀生成 TXT record value。

   规则是：

```text
seaqa-portal-verification=<verification-token>
```

   固定 value 前缀可以降低误匹配风险，也方便用户和运维人员识别该 TXT 记录用途。

4. 将 TXT name 和 TXT value 返回给前端展示。

   前端应同时展示完整记录名和提示说明。很多 DNS 服务商的“主机记录”字段需要填写相对名称，例如 `_seaqa-portal-challenge.support`，而不是完整域名。文案要降低用户填错概率。

示例：

```text
自定义域名：support.example.com
TXT name：_seaqa-portal-challenge.support.example.com
TXT value：seaqa-portal-verification=9f1a...
```

### 7.4 DNS TXT 验证算法

目标是通过公网 DNS 查询确认用户已经在域名服务商处配置了正确 TXT 记录。只有验证通过后，自定义域名才允许生效。

处理步骤：

1. 先校验项目存在和管理员权限。

   验证通过会改变域名生效状态，所以权限要求和保存域名一致。

2. 查询当前项目绑定的自定义域名记录。

   如果没有绑定记录，返回 `404 custom_domain not found`。不能根据请求参数临时验证任意域名，否则会绕过保存和查重逻辑。

3. 根据绑定记录生成 DNS 查询名和期望值。

   查询名来自当前绑定的 `domain`，期望值来自当前记录的 `verification_token`。这样可以保证用户验证的是“当前项目当前域名”，不是旧域名或其它项目的 token。

```text
record_name = _seaqa-portal-challenge.<domain>
expected_value = seaqa-portal-verification=<verification_token>
```

4. 使用 DNS resolver 查询 `record_name` 的 TXT 记录。

   查询应设置超时时间，避免接口长时间阻塞。`NoAnswer` 或 `NXDOMAIN` 表示用户还没有正确配置 TXT，可返回验证失败；resolver 超时、网络异常或 DNS 服务异常应返回查询失败，便于区分配置错误和系统异常。

5. 规范化 DNS 返回值。

   TXT 结果可能带引号，也可能因为 DNS 协议限制被拆成多段。比较前需要拼接分段、去掉外层引号并 trim。否则用户配置正确也可能因为格式差异验证失败。

6. 遍历所有 TXT 值，只要有一条完全等于期望值就通过。

   使用完全匹配，而不是包含匹配。原因是包含匹配可能误把其它系统的 TXT 记录或被拼接污染的值当成有效验证。

7. 验证通过后更新绑定记录。

   设置 `verified = true` 和 `verified_at = now()`。不要修改 token，保留 token 方便后续排查和展示。域名再次变更时再重置 token。

8. 验证失败时不改变现有状态。

   如果 TXT 不存在或值不匹配，保持 `verified = false`。如果之前已验证的域名没有变化，通常不需要因为一次 DNS 查询失败就自动取消 verified，避免短暂 DNS 故障影响线上访问。域名变化时已在保存阶段重置 verified。

失败处理：

```text
没有绑定记录 -> 404
TXT 不存在或值不匹配 -> 400 TXT record not found or invalid
DNS resolver 超时或异常 -> 500 DNS query failed
```

开发和容器环境注意：

- Docker 默认 DNS `127.0.0.11` 可能缓存 NXDOMAIN，导致权威 DNS 已生效但应用仍验证失败。
- 建议支持配置专用 resolver，例如 `PORTAL_CUSTOM_DOMAIN_DNS_NAMESERVERS=223.5.5.5,223.6.6.6`。
- 该 resolver 只用于 TXT 验证，不应替换容器全局 DNS，避免影响 MySQL、Redis 等容器服务名解析。

### 7.5 Host 路由和路径隔离算法

目标是在同一个应用实例上承载多个客户域名，并确保每个 verified Host 只能访问它绑定的项目 Portal。

处理步骤：

1. 在 Django URL routing 之前读取请求 Host，并去掉端口。

   用户访问 `https://support.example.com/` 时，路由判断必须基于 Host `support.example.com`，而不是路径。端口不属于域名绑定的一部分，本地开发中的 `support.example.com:8000` 也应命中 `support.example.com`。

2. 根据 Host 查询 `portal_custom_domains`。

   如果没有绑定记录或绑定记录未 verified，则不进入自定义域名逻辑。这样未验证域名即使 DNS 指到了平台，也不会被路由到任何项目 Portal。

3. 命中 verified 绑定后，先把绑定对象写入 `request.portal_custom_domain`。

   后续视图和 URL 生成函数可以通过该字段判断当前请求是否来自自定义域名，并生成根路径链接。

4. 规范化请求 path。

   将空路径、重复尾部斜杠等统一成标准形式，例如 `/chat/` 和 `/chat` 应按同一规则处理。这样可以减少路径匹配分支。

5. 对静态资源、媒体资源、登录相关资源和国际化资源直接透传。

   Portal 页面仍需要加载 `/static/`、`/media/`、`/i18n/`、`/accounts/` 等资源。如果这些资源也被 404，Portal 页面无法正常渲染或登录流程会失败。透传只应覆盖必要资源前缀，不能把所有主站路径都放开。

6. 尝试从标准 Portal 路径中提取 `project_uuid`。

   标准路径包括 `/portal/<project_uuid>/`、`/api/v1/portal/<project_uuid>/`、`/file/portal/<project_uuid>/` 等。前端 API 和文件上传下载仍会使用这些标准路径，因此需要识别它们。

7. 如果路径中显式包含 `project_uuid`，必须和 Host 绑定项目一致。

   不一致直接返回 404。原因是如果客户 A 的域名能访问客户 B 的 `/api/v1/portal/<project_b_uuid>/...`，就会造成跨项目数据泄露。这里必须 fail closed，不能回退到普通路由。

8. 如果路径是同一项目的标准 Portal/API/文件路径，则不改写，交给原 URLConf 处理。

   这样可以复用现有 API、上传文件、附件下载、登出和邀请接受逻辑，不需要为自定义域名单独实现一套 API。

9. 如果路径是自定义域名下的根路径页面，则改写为内部标准 Portal 页面路径。

   例如 `/chat/` 改写为 `/portal/<project_uuid>/chat/`。这样视图层仍复用原有 `portal_view`，前端看到的 URL 则保持简洁的根路径。

10. 如果路径不在白名单中，返回 404。

   这是安全边界。verified 自定义 Host 只应该承载 Portal，不应该访问主站 workspace、admin、普通 API 或其它页面。

`extract_project_uuid_from_standard_portal_path()` 需要识别：

```text
/portal/<project_uuid>/...
/portal-edit/<project_uuid>/...
/api/v1/portal/<project_uuid>/...
/portal-external/logout/<project_uuid>/
/portal-external/accept/<token>/<project_uuid>/
/upload-file/portal/<project_uuid>/...
/file/portal/<project_uuid>/...
```

自定义域名根路径映射表：

```text
/                         -> /portal/<project_uuid>/
/submit-issue/            -> /portal/<project_uuid>/submit-issue/
/chat/                    -> /portal/<project_uuid>/chat/
/chat/<session_uuid>/     -> /portal/<project_uuid>/chat/<session_uuid>/
/my-issues/               -> /portal/<project_uuid>/my-issues/
/my-issues/<issue_id>/    -> /portal/<project_uuid>/my-issues/<issue_id>/
/knowledge-base/          -> /portal/<project_uuid>/knowledge-base/
/knowledge-base/<id>/     -> /portal/<project_uuid>/knowledge-base/<id>/
/login/                   -> /portal/<project_uuid>/login/
/anonymous-validate/      -> /portal/<project_uuid>/anonymous-validate/
/logout/                  -> /portal-external/logout/<project_uuid>/
/external/accept/<token>/ -> /portal-external/accept/<token>/<project_uuid>/
```

允许透传的资源路径：

```text
/static/
/media/
/custom-css/
/i18n/
/accounts/
/captcha/
```

路径处理结果：

```text
Host 未验证 + 任意路径 -> 不进入自定义域名路由
Host 已验证 + / -> 改写到 /portal/<project_uuid>/
Host 已验证 + /api/v1/portal/<same_project_uuid>/... -> 透传
Host 已验证 + /api/v1/portal/<other_project_uuid>/... -> 404
Host 已验证 + /workspace/... -> 404
Host 已验证 + /static/... -> 透传
```

### 7.6 域名路由缓存算法

目标是在域名访问量增长后减少数据库查询，同时保证域名保存、验证、删除后能尽快生效。

处理步骤：

1. 每次请求先根据 Host 生成缓存 key。

   key 应基于规范化后的 Host，例如 `portal_custom_domain:support.example.com`。这样大小写和端口不会造成缓存穿透。

2. 先查缓存。

   如果缓存中存在 verified 绑定，直接返回绑定的 `project_uuid`。如果缓存中明确记录未命中或未 verified，直接返回空，避免不存在的 Host 每次都打到数据库。

3. 缓存未命中时查询数据库。

   只把 verified 绑定作为可路由结果返回。未 verified 的记录即使存在，也只能缓存为不可路由状态。

4. 设置较短 TTL。

   推荐 verified 结果缓存 60 秒，未命中或未 verified 结果缓存更短时间。原因是域名绑定属于配置数据，变化不频繁，但用户点击 Verify 后希望尽快生效。

5. 保存、验证、删除域名时主动失效相关缓存。

   保存新域名时需要删除旧域名和新域名缓存；验证成功后删除该域名缓存；删除绑定时删除该域名缓存。主动失效可以避免用户等待 TTL。

6. 缓存异常时降级查数据库。

   缓存不可用不应导致所有自定义域名不可访问。但如果数据库查询也失败，不能构造默认绑定，必须按异常处理，避免把请求路由到错误项目。

推荐缓存内容：

```text
cache_key = "portal_custom_domain:" + normalized_host
cache_value = {
    project_uuid: "...",
    verified: true,
    domain: "support.example.com"
}
ttl = 60 seconds
```

### 7.7 公共 URL 和邀请链接生成算法

目标是对外展示的 URL 和当前域名状态一致，避免未验证域名出现在邮件或复制链接中。

处理步骤：

1. 生成 Portal 公开访问地址时，先查询项目绑定记录。

   如果绑定存在且 verified，返回 `https://<custom-domain>/`。如果没有绑定或未 verified，返回标准 Portal 地址 `/portal/<project_uuid>/`。

2. 设置页只在 verified 后展示可复制的自定义域名 URL。

   原因是保存但未验证的域名还不能访问 Portal；提前展示会误导用户以为配置已经完成。

3. 创建外部邀请链接时同样先判断域名是否 verified。

   如果 verified，邀请链接使用自定义域名根路径下的短路径：

```text
https://support.example.com/external/accept/<token>/
```

   该路径不包含 `project_uuid`，项目归属由 Host 绑定关系决定。

4. 如果没有 verified 自定义域名，邀请链接使用标准路径：

```text
https://service.example.com/portal-external/accept/<token>/<project_uuid>/
```

5. 自定义域名下接受邀请时，middleware 先根据 Host 找到项目，再把 `/external/accept/<token>/` 改写为内部标准邀请路径。

   这样可以复用原有邀请接受视图，同时避免公开链接暴露内部项目 ID。

scheme 规则：

- 产品展示建议固定使用 `https://`，因为生产入口应提供 HTTPS。
- 本地开发可通过 request scheme 或配置项控制。
- 不应根据用户提交的域名内容决定 scheme，因为保存域名时不允许包含 scheme。

### 7.8 TLS ask 准入算法

如果使用 Caddy on-demand TLS，需要 internal ask 接口决定某个域名是否允许自动签发证书。该算法属于入口层安全边界，不能省略。

处理步骤：

1. Caddy 收到某个自定义 Host 的首次 HTTPS 请求。

   此时 Caddy 还没有证书，需要先判断是否允许为该 Host 申请证书。

2. Caddy 调用内部 ask 接口。

```text
GET /internal/portal/custom-domain/allow-tls?domain=support.example.com
```

3. ask 接口先校验请求来源。

   只允许本机、内网网关或明确配置的 Caddy IP 调用。原因是 ask 接口虽然只读，但如果完全公网开放，会被恶意请求用于枚举域名状态或打数据库。

4. 对 `domain` 参数执行同一套域名规范化校验。

   这样可以保证 TLS 准入查询和应用层 Host 查询使用同一种域名格式，避免大小写、尾随点或非法域名造成绕过。

5. 查询 `portal_custom_domains`。

   只有记录存在且 `verified = true` 时返回 `200`。保存但未验证、验证失败、已解绑、被其它系统占用的域名都返回 `403`。

6. 对拒绝结果做短缓存和限流。

   这样可以降低恶意域名批量请求造成的数据库压力，也可以避免触发 ACME 频率限制。

7. Caddy 根据 ask 结果决定是否申请证书。

   `200` 表示允许签发并反代到 Django；`403` 表示拒绝 TLS 握手或返回错误。

输出规则：

```text
domain 是 verified Portal 自定义域名 -> 200
domain 未保存 -> 403
domain 已保存但未 verified -> 403
domain 格式非法 -> 403
请求来源不可信 -> 403
```

为什么不能只靠应用层 middleware：

```text
TLS 握手发生在 HTTP 请求进入 Django 之前。
如果入口层没有证书或不接受该 Host，请求根本到不了 middleware。
所以 Caddy/Ingress/CDN 必须先完成 Host 接入和证书处理。
```

### 7.9 DNS target 检测算法（后续增强）

TXT 验证只能证明域名所有权，不能证明访问流量已经指向平台入口。因此可能出现“Verify 成功，但浏览器访问打不开”的情况。后续可以增加 DNS target 检测作为辅助提示。

处理步骤：

1. 用户保存域名后，系统仍先生成 TXT challenge。

   TXT 验证是权属验证，不能被 CNAME/A 检测替代。CNAME 指向平台只能说明流量可能到达平台，不能证明配置者拥有该域名。

2. 系统查询自定义域名本身的 CNAME。

   如果用户绑定的是子域名，例如 `support.example.com`，理想情况下它的 CNAME 应指向 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET`。

3. 如果没有 CNAME，则查询 A/AAAA。

   根域名通常不能配置普通 CNAME，可能通过 ALIAS/ANAME 最终表现为 A/AAAA。此时可以检查解析结果是否落在平台 ingress IP 列表中。

4. 如果客户使用 CDN 代理，不强制要求 CNAME 直接等于平台 target。

   CDN 场景下，客户域名可能 CNAME 到 CDN，而 CDN 再回源到平台。此时 target 检测只能作为提示，不能直接判定配置错误。

5. 前端展示 target 检测状态。

   建议文案区分两个状态：`Ownership verified` 和 `Traffic target detected`。这样用户能理解 TXT 验证通过后，仍可能需要等待 CNAME/A 生效或检查入口层配置。

检测逻辑：

```text
check_cname(domain):
    answers = query CNAME domain
    return any(answer == PORTAL_CUSTOM_DOMAIN_DNS_TARGET)

check_address(domain):
    answers = query A/AAAA domain
    return any(answer in PORTAL_INGRESS_IPS)
```

为什么只作为提示：

- 根域名可能使用 ALIAS/ANAME，递归查询表现为 A/AAAA。
- 客户可能通过 CDN 代理访问，CNAME 不一定直接等于平台 target。
- DNS 传播有延迟，强依赖 target 检测容易误伤。

## 8. TLS 证书设计

### 8.1 谁获取证书

证书应该由我们平台侧网关自动获取和续期。

用户只负责 DNS：

- CNAME/ALIAS/A 指向我们的 Portal ingress。
- TXT challenge 证明域名所有权。

不建议要求用户上传证书，也不建议运维为每个域名手工配置证书。

### 8.2 TLS 不在 Django 层处理

Django 应用只看到已经被网关转发过来的 HTTP 请求。TLS 握手发生在网关层，因此证书配置位置是：

- Caddy
- Nginx / OpenResty
- Kubernetes Ingress
- 云 Load Balancer
- CDN

Django 不负责 ACME challenge、证书私钥存储、TLS reload。

### 8.3 推荐 MVP：Caddy On-Demand TLS

如果当前部署是普通 VM 或单机服务，最简单方案是使用 Caddy 作为 Portal ingress。

请求链路：

```text
User Browser
  -> https://support.example.com
  -> DNS CNAME portal.seaqa.example.com
  -> Caddy
  -> Django/Gunicorn
```

Caddy 负责：

- 接收任意客户自定义域名 Host。
- 在首次 HTTPS 请求时申请 Let’s Encrypt 证书。
- 缓存证书。
- 自动续期。
- 反向代理到 Django。

基础 Caddyfile 示例：

```caddyfile
{
  email ops@example.com
}

:443 {
  tls {
    on_demand
  }

  reverse_proxy 127.0.0.1:8000
}
```

但不能直接开放 unrestricted on-demand TLS，否则任何人把域名解析到我们这里都可能触发证书申请，消耗证书额度。

需要增加 on-demand TLS 准入校验：

```caddyfile
{
  email ops@example.com

  on_demand_tls {
    ask http://127.0.0.1:8000/internal/portal/custom-domain/allow-tls
  }
}

:443 {
  tls {
    on_demand
  }

  reverse_proxy 127.0.0.1:8000
}
```

`ask` 接口逻辑：

```text
GET /internal/portal/custom-domain/allow-tls?domain=support.example.com
```

返回规则：

- 如果 `domain` 是已验证的 Portal 自定义域名，返回 `200`。
- 否则返回 `403`。

当前代码还没有实现该 internal ask 接口。若采用 Caddy on-demand TLS，建议补充该接口。

### 8.4 Kubernetes 推荐：cert-manager + ingress-nginx

如果线上是 Kubernetes，推荐标准方案：

- ingress-nginx 作为入口。
- cert-manager 负责 ACME 证书签发和续期。
- 每个已验证自定义域名创建或更新 Ingress TLS 配置。

流程：

1. 用户保存域名并配置 DNS。
2. 用户完成 TXT 验证。
3. 系统标记域名 verified。
4. 后台任务或控制器创建 Ingress：

   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: portal-custom-domain-support-example-com
     annotations:
       cert-manager.io/cluster-issuer: letsencrypt-prod
   spec:
     ingressClassName: nginx
     tls:
       - hosts:
           - support.example.com
         secretName: portal-custom-domain-support-example-com-tls
     rules:
       - host: support.example.com
         http:
           paths:
             - path: /
               pathType: Prefix
               backend:
                 service:
                   name: seaqa-web
                   port:
                     number: 80
   ```

5. cert-manager 通过 HTTP-01 或 DNS-01 完成证书签发。
6. ingress-nginx 自动加载证书。

注意：

- HTTP-01 要求 `support.example.com` 已经解析到 ingress。
- DNS-01 需要平台有 DNS Provider API 权限，一般不适合客户自有域名，除非客户授权。
- 对客户自有域名，HTTP-01 更常见。

### 8.5 Nginx + certbot 方案

如果必须使用传统 Nginx：

1. 保存并验证域名。
2. 后台任务为该域名生成 Nginx server 配置。
3. 执行 certbot 或 acme.sh 签发证书。
4. 写入证书路径。
5. reload Nginx。
6. 配置自动续期。

该方案可行，但不建议作为首选，因为：

- 需要动态写配置文件。
- reload 失败会影响线上入口。
- 证书续期、失败重试、并发控制都要自己处理。
- 运维复杂度高于 Caddy 或 cert-manager。

### 8.6 是否需要人工处理

目标方案不需要人工处理单个客户域名。

人工只需要处理平台级配置：

- 配置 Portal ingress 域名，例如 `portal.seaqa.example.com`。
- 配置 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET`。
- 配置 Caddy/cert-manager。
- 配置证书申请邮箱、ACME issuer、限流和监控。

客户每新增一个域名，不应该需要运维手动登录服务器修改配置。

## 9. 线上部署方案

### 9.1 必需配置

应用配置：

```text
PORTAL_CUSTOM_DOMAIN_DNS_TARGET=portal.seaqa.example.com
SEAQA_WEB_SERVICE_URL=https://app.seaqa.example.com
```

DNS：

```text
portal.seaqa.example.com -> Portal ingress IP
```

客户域名：

```text
support.example.com CNAME portal.seaqa.example.com
_seaqa-portal-challenge.support.example.com TXT seaqa-portal-verification=<token>
```

网关：

- 接受客户自定义 Host。
- 保留原始 Host 转发给 Django。
- 设置 `X-Forwarded-Proto`，确保应用能判断 HTTPS。
- 负责 TLS 证书签发和续期。

### 9.2 推荐上线顺序

1. 上线数据库表。
2. 上线应用代码，但暂不对外宣传功能。
3. 配置 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET`。
4. 配置 Portal ingress 支持自定义 Host。
5. 配置 TLS 自动签发。
6. 使用测试域名完成端到端验证。
7. 开放给用户。

### 9.3 证书签发状态

当前应用只记录域名 TXT 验证状态，没有记录证书状态。

如果需要更完整的产品体验，建议后续增加：

```text
tls_status: pending | issuing | active | failed
tls_error: text
tls_issued_at: datetime
```

MVP 可以先不入库证书状态，但 UI 文案应明确：

```text
DNS verification passed. HTTPS may take a few minutes to become available.
```

## 10. 本地测试

### 10.1 测试 Host 路由

本地不需要真实 DNS，可以使用 `/etc/hosts`。

添加：

```text
127.0.0.1 support.local.test
```

数据库插入已验证记录：

```sql
INSERT INTO portal_custom_domains
(domain, project_uuid, verification_token, verified, verified_at, created_at, updated_at)
VALUES
('support.local.test', '<project_uuid>', 'local-test-token', 1, NOW(6), NOW(6), NOW(6));
```

启动本地 Web 服务后访问：

```text
http://support.local.test:<port>/
```

预期：

- 中间件识别 Host。
- `/` 映射到 `/portal/<project_uuid>/`。
- 页面内部路由使用 `/chat/`、`/my-issues/` 等根路径。

### 10.2 测试 Host 与 project_uuid 不匹配

使用已验证记录：

```sql
INSERT INTO portal_custom_domains
(domain, project_uuid, verification_token, verified, verified_at, created_at, updated_at)
VALUES
('support.local.test', '<project_uuid>', 'local-test-token', 1, NOW(6), NOW(6), NOW(6));
```

访问其他项目的标准 Portal 或 Portal API：

```text
http://support.local.test:<port>/portal/<other_project_uuid>/
http://support.local.test:<port>/api/v1/portal/<other_project_uuid>/settings/
```

预期：

- 返回 404。
- 不应展示或返回其他项目的 Portal 内容。
- 同一 `project_uuid` 的 API 请求可以继续由原 API 处理，但不会映射到其他项目。

### 10.3 测试邀请链接

已验证自定义域名后，创建 Portal 外部用户邀请。

预期：

- 列表接口和邀请邮件中的链接使用 `https://support.local.test/external/accept/<token>/`。
- 访问 `/external/accept/<token>/` 会映射到绑定项目的内部接受邀请路由。
- 未验证或未配置自定义域名时，邀请链接仍使用标准 `/portal-external/accept/<token>/<project_uuid>/`。

### 10.4 测试未验证域名不生效

插入或更新：

```sql
UPDATE portal_custom_domains
SET verified = 0, verified_at = NULL
WHERE domain = 'support.local.test';
```

访问：

```text
http://support.local.test:<port>/
```

预期：

- 不应映射到 Portal。
- 不应展示该 Portal 内容。

### 10.5 测试完整 DNS TXT 验证

完整 Verify 流程需要真实可配置 DNS 的域名。`/etc/hosts` 不能让后端 DNS TXT 查询成功。

测试步骤：

1. 准备测试域名，例如 `portal-test.example.com`。
2. 在产品内保存该域名。
3. 根据设置页展示内容添加 TXT。
4. 使用命令确认 TXT 生效：

   ```bash
   dig TXT _seaqa-portal-challenge.portal-test.example.com
   ```

5. 点击 Verify。
6. 确认状态变为 verified。

### 10.6 本地 TLS 测试

本地一般不测试 Let’s Encrypt，因为 ACME 需要公网可访问域名。

可选方案：

- 只测 HTTP Host 路由。
- 使用 Caddy 本地自签证书测试 HTTPS。
- 使用 ngrok/cloudflared 暴露本地服务，再用真实测试域名做端到端验证。

## 11. 错误和边界场景

### 11.1 保存域名但未配置 DNS

结果：

- 保存成功。
- 状态是 Not verified。
- 自定义域名不生效。

### 11.2 只配置 TXT，不配置 CNAME

结果：

- Verify 可以成功。
- 应用层认为域名已验证。
- 但用户访问域名可能打不开，因为流量没有指向 Portal ingress。

可选增强：

- 在 Verify 时同时检查 CNAME/A 是否指向平台 DNS target。
- 或在 UI 上显示 DNS target 检测状态。

### 11.3 只配置 CNAME，不配置 TXT

结果：

- 流量可能能到达平台网关。
- 应用层不会映射到 Portal，因为域名未 verified。
- Verify 会失败。

### 11.4 DNS 已正确配置但 HTTPS 不可用

可能原因：

- 证书还在签发中。
- ACME HTTP-01 无法访问。
- 域名经过 CDN 代理导致 ACME 验证失败。
- Caddy/cert-manager 未正确配置。
- Let’s Encrypt rate limit。

处理：

- 检查网关证书签发日志。
- 检查域名是否解析到 Portal ingress。
- 检查 `/.well-known/acme-challenge/` 是否能到达 ACME handler。
- 检查是否开启 CDN proxy。

### 11.5 用户更换域名

结果：

- 新域名保存后重新生成 token。
- `verified` 重置为 false。
- 旧域名不再绑定该 Portal。
- 新域名必须重新配置 TXT 并验证。

### 11.6 Host 已验证但 project_uuid 不匹配

场景：

- `support.example.com` 已验证并绑定到项目 A。
- 请求路径显式访问项目 B，例如 `/portal/<project_b_uuid>/` 或 `/api/v1/portal/<project_b_uuid>/...`。

结果：

- 应用直接返回 404。
- 不应回退到标准 Portal 路由。
- 不应返回项目 B 的 Portal 页面、API 数据、文件或邀请/登录相关响应。

## 12. 安全考虑

- 只有项目管理员可以保存和验证自定义域名。
- 域名保存后不会立即生效，必须 TXT 验证。
- Host 路由只接受 verified 域名。
- verified 自定义 Host 下，所有显式包含 `project_uuid` 的 Portal 页面、Portal API、文件、邀请和登出路径都必须与绑定项目一致；不一致直接 404。
- 邀请链接只使用 verified 域名。
- Caddy on-demand TLS 必须配置 ask 接口，防止任意域名触发证书申请。
- 不允许用户输入 scheme、path、query、fragment、port。
- 自定义域名不能等于平台自身服务域名。
- 生产环境应限制内部 TLS ask 接口只能被本机或网关访问。

## 13. 运维监控建议

建议监控：

- 域名验证失败次数。
- DNS 查询异常。
- 已验证域名数量。
- TLS 签发成功率。
- TLS 签发失败原因。
- 证书即将过期数量。
- 自定义域名 Host 请求 4xx/5xx。

建议日志：

- 保存域名：project_uuid、domain、operator。
- 验证成功/失败：project_uuid、domain、reason。
- Host 路由命中：domain、project_uuid。
- Host/project_uuid 不匹配拒绝：domain、bound_project_uuid、requested_project_uuid、route_type。
- TLS ask 拒绝：domain、reason。

## 14. MVP 建议

最简单且可运维的 MVP：

1. 产品内支持保存域名和 TXT 验证。
2. 用户配置：
   - CNAME 到 `PORTAL_CUSTOM_DOMAIN_DNS_TARGET`。
   - TXT challenge。
3. 应用只对 verified 域名生效。
4. 线上使用 Caddy on-demand TLS。
5. 补充 Caddy ask 接口，只允许 verified 域名签证书。
6. UI 提示：验证通过后 HTTPS 可能需要几分钟生效。

如果当前线上已经是 Kubernetes，则用 `cert-manager + ingress-nginx` 替代 Caddy。

## 15. 后续增强

- 增加 TLS 状态入库和前端展示。
- 验证 CNAME/A 是否指向平台 DNS target。
- 支持 apex domain 的 ALIAS/A 记录检测。
- 支持多个自定义域名绑定到同一个 Portal。
- 增加后台任务定期重新校验域名 DNS。
- 自定义域名解绑时清理网关证书或 Ingress 配置。
- 提供用户可复制的一键 DNS 配置说明。
