# SeaMetadata 实例与控制器

[English documentation](./README.md)

`metadataID` 就是主表 ID，用于定位应用内已挂载的表格实例。它不是后端表名或记录 ID。同一份后端数据在页面和 dialog 同时展示时，应为两个实例指定不同的 `metadataID`。

```jsx
import SeaMetadata, { useSeaMetadataController, EVENT_BUS_TYPE } from '@/sea-metadata';

function Page() {
  return <SeaMetadata metadataID="page1-main" api={pageAPI} />;
}

function Dialog() {
  return <SeaMetadata metadataID="page1-dialog" api={dialogAPI} />;
}

// 可位于其他组件或路由，无需逐层传入 controller。
function Actions() {
  const main = useSeaMetadataController('page1-main');
  const dialog = useSeaMetadataController('page1-dialog');
  return <>
    <button onClick={() => main.reload()}>刷新主表</button>
    <button onClick={() => dialog.reload()}>刷新 dialog 表格</button>
  </>;
}
```

- 同一个 ID 同时只能绑定一个表格，重复挂载会抛出错误。支持非空字符串和有限数字（`0` 有效，数字 `0` 与字符串 `'0'` 指向同一实例）。
- 不传 `metadataID` 时，每次挂载都创建独立的匿名实例；不会继承父表。
- 同一浏览器应用中的组件和路由可以按 ID 访问。目标路由卸载后，控制器不会保持表格挂载，也不会缓存或重放命令；不跨浏览器标签页通信。
- 目标未挂载时，`getData()` 和 `storage` 返回 `null`；`getOrderRows()`、`getSelectedRowIds()`、`createMoreOptions()` 返回空数组；刷新和更新忽略。

## 事件与数据

```jsx
const table = useSeaMetadataController('page1-main');

useEffect(() => {
  return table.events.subscribe(EVENT_BUS_TYPE.SAVED, () => {
    // 只接收该实例的保存事件；卸载时取消订阅。
  });
}, [table]);

// 与 table.reload() 等价。
table.events.dispatch(EVENT_BUS_TYPE.RELOAD_DATA);
// 更新当前已加载的本地行；持久化操作仍使用业务 API。
table.updateRow(rowID, { title: '新标题' });
const selected = table.getSelectedRowIds();
```

每个实例独立持有 Context、Store、事件总线、选择状态和表格 DOM 引用。搜索、复制粘贴、快捷键与列拖动按所属实例处理。`RESOURCE_UPDATED` 等业务事件仍属于应用总线；多个列表可按现有业务规则同步同一资源。

工单、客户问题和连接记录的详情保存通过 `RESOURCE_UPDATED` 通知匹配项目与表名的列表，因此全局“相关问题”弹窗即使位于主表 Provider 外，也能更新对应记录，不依赖弹窗继承的 controller。

视图标签、“全部视图”菜单与分组规则的拖动仅在所属实例内生效；其他实例的拖动不会修改当前表格，视图排序也不会接受外部应用拖入的普通文本。

表格编辑器的 portal 也带有实例标记。内部选项编辑器通过通用 `shouldHandleEvent` 回调限制键盘事件，浮层通过可选的 `PopoverComponent` 使用实例包装；共享组件无需导入 SeaMetadata。嵌套选项浮层处理 Escape 后，父浮层保持打开。controller 解绑后，旧 runtime 持有的事件总线失效，不会向同 ID 的新实例发送事件；按 ID 获取的 controller 仍可正常访问新实例。

焦点在表格或其浮层内时，搜索和 Escape 按所属实例处理。浮层打开后持有焦点，关闭时将焦点还给触发控件；已移到其他输入框的焦点不受影响。Escape 关闭浮层或选择菜单后，对应的松键事件也会被消费，避免焦点恢复后继续关闭外层 dialog。焦点在页面 `body` 时，仅当页面有唯一可见的 `storageNamespace="primary"` 主表且没有打开的 dialog，Ctrl/Cmd+F 才打开该表的搜索。

视图切换会销毁旧 Store，旧请求返回后不能再写入表格或触发旧视图回调。已发送请求的失败仍通过独立的 `onOperationError` 通知显示错误，避免切换视图后静默失败。

整张表卸载时先解除 controller 绑定和 runtime 订阅，随后允许单元格编辑器按既有行为提交尚未保存的修改，最后清理 Context。提交使用卸载实例原有的 API，不会发送到随后挂载的表格；controller 的外部订阅可继续跟随后续实例。

## 存储与 URL

本地设置的 key 包含 `localStorageNamePrefix`、`metadataID` / 匿名实例标识、`storageNamespace` 和视图 ID。命名实例重新挂载后可以恢复自己的设置。现有页面显式使用 `storageNamespace="primary"`，并兼容读取旧的 `prefix-viewID` 设置；新写入使用隔离后的 key。

`metadataID` 应在编辑记录后保持稳定，不能使用记录内容或更新时间拼接。客户和用户主表按项目使用固定 ID，数据变化通过独立的 React `key` 触发重新加载，保留排序和列宽。

新表格默认不读取或修改 URL 里的 `view` 参数。需要地址栏同步时显式指定：

```jsx
<SeaMetadata metadataID="page1-main" api={pageAPI} isShowViewInURL />
<SeaMetadata metadataID="page1-dialog" api={dialogAPI}
  isShowViewInURL viewURLParam="dialogView" />
```

同时启用 URL 同步的表格应使用不同的 `viewURLParam`。现有主页面已显式保留原来的 URL 行为。

## 迁移与兼容

全局 `context` 导出已移除；表格事件调用改为控制器的 `events`。原有 ref 的 `getData()`、`getOrderRows()`、`createMoreOptions()` 保留，并提供 `getSelectedRowIds()`。当前 PR 的资源菜单仍绑定创建菜单时的 Store，视图切换或卸载后旧菜单不会操作新 Store。

`@/sea-metadata/controller-provider` 是不加载表格视图的轻量控制器入口。宿主在模块顶层调用 `withSeaMetadataController` 时从该入口导入，以避免表格视图经资源详情再次加载宿主时，公共入口尚未初始化。

现有页面中由父组件、同级工具栏和子表格共同使用的工作流，通过 `SeaMetadataControllerProvider` / `useMetadataController()` 共享作用域。独立的 `Tickets`、`Issues` 和客户弹窗宿主各自创建作用域；传入已有 `controller` 可显式复用。若同时提供匿名作用域控制器和 `metadataID`，两种入口指向同一张表，按 ID 的调用仍然有效。命名控制器与表格的 `metadataID` 必须一致。

项目知识库主表的 ID 为 `project-knowledge-main-${projectUuid}`。位于主内容 Provider 外部的侧栏导入弹窗通过这个 ID 获取控制器，导入完成后只刷新对应项目的主表。

`SeaMetadataScope` 用于单独复用选择 Provider、卡片等内部控件的场景，不负责挂载或注册整张表。

本次沿用原有页面、业务 hooks 与 SeaMetadata 的依赖关系，仅迁移实例访问入口；这些既有的深层导入应在后续模块公共 API 整理中统一收敛。
