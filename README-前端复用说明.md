# 思维导图新手引导 — 前端复用代码包

> 给前端开发同事  
> 来源：EA Platform V1.0.3，2026-07-14 源码快照  
> 说明：本目录是便于分享的代码副本，不是当前工程的运行源目录。

## 重要说明

- 当前工程的正式源码仍位于 `app/src/app/components/`。
- 本目录文件用于阅读、评估和迁移，不要在本目录修改后期待 EA 工程自动生效。
- 如果继续维护当前 EA 工程，请修改 `app/src/app/components/` 中的对应文件。
- 这些文件之间存在相对导入关系，也依赖 React、Tailwind、Lucide React、`@xyflow/react` 及工程中的部分其他组件，因此不是一个可独立运行的 npm 包。

## 推荐阅读顺序

1. `CreateCaseMindMapFlow.tsx`
2. `MindMapFlow.tsx`
3. `CreateCase.tsx`
4. `data.ts`
5. 其余 UI 依赖组件

## 文件说明

### `CreateCaseMindMapFlow.tsx`

新建 Case 思维导图和新手引导的核心实现。可复用：

- `CoachStep`
- `COACH_STEPS`
- `COACH_CONTENT`
- `CreateCaseSpotlight`
- `data-create-guide` 目标定位约定
- SVG/圆角 Spotlight 遮罩
- 引导浮窗和步骤进度
- `localStorage` 首次展示与“不再显示”
- 真实操作驱动的步骤推进
- 图例与任务卡紧急度色条的高亮连线
- 全屏、缩略图、React Flow 控件和工具栏介绍
- 思路、任务、子思路的创建逻辑

### `MindMapFlow.tsx`

“我的 Case”正式思维导图，是样式与交互基准。可复用：

- React Flow 节点/边组织
- 思路卡和任务卡样式
- `smoothstep` 圆角连线
- 共享主干路由
- 编辑卡扩张后的布局避让
- 图例、缩略图、全屏和筛选工具栏

### `CreateCase.tsx`

新建 Case 主流程。可参考：

- `ThoughtGroup`
- `ActionCard`
- 新建 Case 与思维导图之间的数据传递
- 保存 Case 时的节点数据转换

该文件体积较大，迁移新手引导时通常只需要提取类型和数据交互，不建议整体照搬。

### `data.ts`

领域模型、Mock 数据和颜色映射。重点参考：

- `CaseItem`
- `TaskNode`
- `Urgency`
- `urgencyBar`
- `levelColors`
- `currentUser`
- `ownerToDepartment`

图例和任务卡左侧紧急度色条应复用同一颜色映射，避免两套配置不一致。

### `AttachmentInput.tsx`

任务附件输入组件，支持紧凑模式。

### `VoiceNote.tsx`

语音备注录制及播放：

- `VoiceRecorder`
- `VoicePlayer`

### `StatusBadge.tsx`

任务状态图标和状态样式。

### `CaseProductPill.tsx`

Case 产品 Pill，设计规则是始终紧跟 L1–L5 层级标签。

## 建议前端抽取方式

建议不要长期把 Spotlight 留在大组件中，可拆分为：

- `MindMapSpotlight.tsx`：遮罩、高亮、引导浮窗、位置计算。
- `mindMapGuideSteps.ts`：步骤和文案配置。
- `useMindMapGuide.ts`：步骤状态、持久化和真实操作推进。
- `UrgencyLegend.tsx`：图例与任务卡色条联动。
- `mindMapLayout.ts`：节点布局和连线路由。

## 依赖

核心依赖：

- React 18
- TypeScript
- `@xyflow/react`
- `lucide-react`
- Tailwind CSS v4

工程内依赖：

- `AddTaskModal.tsx` 中的类型
- `TaskCommentsPanel.tsx`
- `CreateCase` 使用的其他表单组件
- `domainStore.ts`
- 其他 Case 业务组件

迁移时建议先提取 Spotlight 和步骤状态，不要直接尝试单独编译整个目录。

## 验证重点

- 引导目标不存在时不能卡死页面。
- 全屏、窗口缩放、浏览器缩放后 Spotlight 位置正确。
- 横向和纵向布局下连线正确。
- 保存任务后先收起编辑卡，再移动到图例。
- 图例和任务卡紧急度色条使用同一 `urgencyBar` 映射。
- `localStorage` Key 升级后，旧用户可以看到新版引导。
