# Design

## Source of truth

- Status: Active，当前 UI 已由产品所有者完成手测确认；后续视觉修改需保持本文件约束
- Last refreshed: 2026-07-22
- Primary product surfaces: 登录与注册、首页、计划、日历、统计、设置、全局专注状态
- Evidence reviewed: `docs/product/PRD.md`、`docs/architecture/TECHNICAL_DESIGN.md`、`.omx/interviews/personal-dashboard-20260720T083155Z.md`
- Visual evidence: 已有可操作前端样例并经产品所有者手测确认；后续截图与视觉烟测应以当前实现为起点，前端样例不自动覆盖本文件

## Brand

- Personality: 安静、清醒、克制、可信，像长期使用的个人工作台，而不是打卡应用或营销产品
- Trust signals: 时间和统计可解释、状态明确、危险操作可预期、外部服务失败不干扰核心数据
- Avoid: 营销式首页、夸张 hero、卡片套卡片、装饰性渐变与光斑、游戏化奖励、情绪评判、单一色相统治整个界面

## Product goals

- Goals: 帮助用户看清今日与本周计划、低摩擦记录真实专注、理解时间投入并延续未完成事项
- Non-goals: 首版不做社交、自动规划、Agent 交互、游戏化、复杂协作和原生应用
- Success signals: 晨间定向快速完成；开始无归属专注只需一个主要动作；周历能同时解释计划与事实；统计可追溯

## Personas and jobs

- Primary personas: 面板所有者；在 `REGISTRATION_MODE=open` 时也可以是同一实例中的独立个人账号
- User jobs: 查看今天、组织本周、开始或补录专注、完成或归档条目、查看日程、回顾投入、修改个人资料
- Key contexts of use: 上学日早晨、课间或课上临时专注、晚间补录、周末结转、假期按自定计划生活、桌面深度整理、手机快速操作

## Information architecture

- Primary navigation: 首页、计划、日历、统计、设置
- Core routes/screens: 登录、首次注册、首页、本周计划与条目树、条目详情、周历、统计、设置、专注结束与拆分流程
- Content hierarchy: 当前行动和今日信息优先；本周承诺其次；历史、统计和配置按需进入
- Global state: 活动计时器在所有登录后页面可见、可结束，但不遮挡导航和主要操作

## Design principles

- 事实先于分类：允许无归属开始、结束后直接保存、稍后整理
- 计划与事实并行：日程和专注使用不同视觉语义，重叠不自动判错
- 层级可读优先：树形深度通过缩进、连接与展开状态表达，不堆叠容器
- 数据可解释：直接投入、聚合投入和未关联投入用明确术语区分
- 常用动作靠近上下文：条目旁创建子项，日历空白处补录，活动计时器处结束
- 渐进披露：默认表单保持短小，拆分、成果、重复规则等复杂选项按需展开
- Tradeoffs: 宁可减少首页信息密度，也不让提醒、时间和活动状态争夺视觉主导；宁可多一步确认危险操作，也不允许隐式丢失历史

## Visual language

- Color: 由前端样例提出，但必须至少区分中性色界面、计划时间、实际专注、提醒或逾期、成功完成；不能只靠颜色表达状态
- Typography: 中文正文优先保证阅读与数字对齐；面板内标题克制，不使用 hero 级大字；字距为 0
- Spacing/layout rhythm: 紧凑但不拥挤，桌面端适合扫描与重复操作，移动端优先单列任务流
- Shape/radius/elevation: 控件和重复项圆角不超过 8px；页面区块不做漂浮卡片；模态框、单个重复项和真正工具容器才使用边框或阴影
- Motion: 只用于状态连续性、展开折叠和轻量反馈；尊重 reduced motion；计时数字变化不得造成布局跳动
- Imagery/iconography: 功能按钮优先 Lucide 图标；天气可使用简洁图标；不需要插画、人物或装饰性背景图

## Components

- Existing components to reuse: 当前 AppShell、日历轨道、日程编辑弹窗与 ICS 导入弹窗；导入接入真实 API 时保持既有弹窗布局、预览选择和就地错误表达
- New/changed components: AppShell、PrimaryNav、GlobalFocusBar、EntryTree、EntryRow、WeekPlanList、ScheduleGrid、FocusBlock、ScheduleBlock、StatBreakdown、TimeTrend、DeadlineList、ProfileForm、FocusEditor、SegmentEditor
- Variants and states: 活跃、暂停、完成、归档、逾期、临期、未关联、加载、空、错误、禁用；日程与专注必须有稳定独立变体
- Token/component ownership: 前端样例应输出颜色、排版、间距和状态 token；正式实现吸收其思想后由根 `DESIGN.md` 维护最终 token 语义

## Accessibility

- Target standard: 核心流程以 WCAG 2.2 AA 为目标
- Keyboard/focus behavior: 导航、树展开、表单、日历事件和模态框可使用键盘；焦点可见；模态框正确锁定和恢复焦点
- Contrast/readability: 正文、次要文本和状态达到可读对比度；图表提供数值或列表替代
- Screen-reader semantics: 使用语义标题、列表、树或适当 ARIA；图标按钮有可访问名称；计时状态变化避免过度播报
- Reduced motion and sensory considerations: 支持 reduced motion；逾期和错误不使用闪烁；状态不依赖颜色或动画

## Responsive behavior

- Supported breakpoints/devices: 约 360px 手机宽度至宽屏桌面；重点验证 390x844、768x1024、1440x900
- Layout adaptations: 桌面导航可为侧栏，移动端使用稳定底部或顶部导航；计划树与详情由双栏降为逐层页面或抽屉；统计图转换为纵向布局
- Touch/hover differences: 所有关键能力必须有点击入口，不能只依赖 hover；触摸目标保持合理尺寸
- Calendar: 桌面周网格使用完整 `00:00-24:00` 时间轴，跨日事件必须在相邻日期的准确时段分别呈现；手机首次进入默认单日纵览，用户可主动切换至紧凑列表或周网格，不强求把七列硬塞入窄屏

## Interaction states

- Loading: 首次恢复会话时可使用全页状态；后续写入后的重校验必须在后台完成，保持当前页面与已输入内容稳定，只在相关控件显示提交中状态
- Empty: 提供与当前页面直接相关的首个动作，例如创建条目、加入本周、开始无归属专注或新增日程
- Error: 说明发生了什么并提供可执行恢复；表单保留输入；领域冲突定位到具体时段或对象
- Success: 就地更新并使用简短反馈，不以庆祝动画打断工作流
- Disabled: 说明禁用原因，例如已有活动计时器或注册已关闭
- ICS import: 文件选择后保持两阶段“预览 -> 确认”；过滤项和窗口限制在预览内说明，确认过期后保留文件选择并提示重新解析
- Offline/slow network: 天气异步降级；季节名句由本地内容包直接展示，不应因网络进入错误状态；核心写入失败不得假装成功；活动计时 UI 明确同步状态

## Content voice

- Tone: 直接、平静、具体，不评判用户是否自律
- Terminology: 使用“条目”“持续型”“可完成型”“本周计划”“专注”“直接投入”“聚合投入”“未关联”“日程”
- Microcopy rules: 优先说明对象与结果；删除和归档必须区分；避免“你又逾期了”等责备语气；不在页面堆砌使用说明和功能宣传

## Implementation constraints

- Framework/styling system: Next.js、React、TypeScript、Tailwind CSS、Radix primitives、Lucide
- Design-token constraints: 颜色和尺寸使用语义 token；日程、专注、完成和危险状态不能散落硬编码色值
- Performance constraints: 活动计时数字不触发全页刷新；确认写入后的数据重校验不卸载当前工作台，深树和周历更新避免明显重排；天气异步加载，名句从本地内容包读取
- Compatibility constraints: 响应式 Web；桌面和手机现代浏览器；鼠标、键盘和触摸可用
- Test/screenshot expectations: 前端样例交付桌面和手机关键页面截图；正式实现后再建立稳定视觉基线
- Source priority: PRD 决定产品语义，本文决定设计原则，前端样例提供视觉与交互参考但不是像素级强约束

## Open questions

- [ ] 前端样例确定最终导航形态、视觉 token 与信息密度 / 前端样例 Agent / 影响整体 UI
- [ ] 周历中计划与专注重叠的最终视觉策略 / 前端样例 Agent / 影响日历组件选择
- [ ] 专注结束与片段拆分采用模态框、抽屉还是独立页面 / 前端样例 Agent / 影响移动端流程
- [ ] 深层条目在手机端采用逐级导航还是可折叠树 / 前端样例 Agent / 影响计划页面结构
