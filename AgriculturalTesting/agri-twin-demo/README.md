# AgriTwin · 智慧农业数字孪生平台（演示原型）

一个前后端真实分离、带完整登录体系与双端（用户端 / 管理端）的智慧农业 Web 应用，用于向指导老师演示项目整体架构与产品形态。

> **当前状态（哪些是真、哪些是占位）**
> - ✅ **真**：页面结构、导航、登录体系、数据流、前后端 HTTP 通信、路由守卫、状态管理、内存假数据。
> - ✅ **真**：病害识别已接入 ONNX 水稻分类模型，可返回模型类别与置信度；识别准确率仍需用独立测试集评估。
> - ✅ **露天水田场景**：平原与梯田均有 5×5 子区域、泥层、水面、田埂和程序化低面数水稻；稻株以全局实例批次渲染，便于后续替换模型工厂。
> - 🟡 **演示**：社区发帖/点赞/评论、个人资料保存均写入后端内存，无持久化与审核落库。

## 技术栈

- 前端：HTML + CSS + JavaScript + Vue 3 + Vite + Vue Router + Three.js（npm 安装）
- 后端：Python + FastAPI + Uvicorn
- 状态存储：前端用 localStorage 保存登录状态；后端用内存字典模拟数据，**不引入数据库**
- 无 TypeScript、无 UI 组件库（Element Plus / Ant Design 均未使用），样式全部手写

## 目录结构

```
agri-twin-demo/
├── backend/
│   ├── main.py             # FastAPI 全部接口 + CORS + 简单鉴权
│   ├── data.py             # 内存假数据（登录账号 / 帖子 / 消息 / 用户等）
│   └── requirements.txt
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.js         # 应用入口
        ├── App.vue         # 全局「后端未连接」提示 + 轻提示
        ├── router.js       # 路由 + 登录/权限守卫
        ├── api.js          # 所有 fetch 请求封装（带 token/role 请求头）
        ├── store.js        # localStorage 登录状态 + 全局响应式状态
        ├── style.css       # 全局 Apple 风格样式与共享类
        ├── layouts/
        │   ├── UserLayout.vue    # 用户端顶部导航布局
        │   └── AdminLayout.vue   # 管理端侧边栏布局
        ├── scene/          # 地区配置、水田构建器、稻株工厂和实例批次
        ├── views/          # 12 个页面（见下方页面地图）
        └── components/     # MossStory / SceneViewer / TwinScene / NewsCard / StockCard / PostCard / MessageItem / StatCard / EmptyState
```

## 启动方式

### 1. 后端（FastAPI）

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

后端监听 http://localhost:8000，已开启 CORS 允许 http://localhost:5173。

### 2. 前端（Vite + Vue 3）

```bash
cd frontend
npm install
npm run dev
```

水稻批次的纯逻辑定向测试（从项目根目录执行，Windows）：

```powershell
npm --prefix .\frontend run test:rice
npm --prefix .\frontend run test:simulation
npm --prefix .\frontend run test:components
```

### 3. 打开

浏览器访问 **http://localhost:5173**（首次进入会跳转登录页）。

## 演示账号

| 角色 | 邮箱 | 密码 |
| ---- | ---- | ---- |
| 普通用户 | `user@demo.com` | `demo123` |
| 管理员 | `admin@demo.com` | `demo123` |

登录页提供两个「快速登录」胶囊按钮，可一键填入并进入对应端。

## 页面地图

| 路由 | 页面 | 功能 |
| ---- | ---- | ---- |
| `/login` | 登录页 | 表单登录 + 两个快速登录按钮 |
| `/home` | 首页 | 长滚动故事（漂浮苔藓岛飞入 → 愿景 → 地块核算/热点 → 田间站点 → 解决方案）+ 欢迎区 + 政策资讯 + 农业股票（红涨绿跌）+ 平台公告 |
| `/community` | 共享社区 | 帖子列表、筛选、发布案例、点赞、详情与评论 |
| `/detect` | 病害识别 | 批量拖拽上传（最多 5 张）、ONNX 水稻病害分类结果（置信度 + 复核建议）、病害知识库、识别历史 |
| `/twin` | 孪生平台 | 统计卡片、通用场景预览、最近告警、快捷入口和进入全屏操作界面入口 |
| `/twin/studio` | 孪生操作界面 | 左侧环境摘要、中间两处 3D 水田、右侧子区域参数/土壤详情、底部地块结构/天气/告警；场景支持自由旋转、右键或 Shift+左键平移、滚轮缩放，选择子区域时相机平滑聚焦、取消选择后返回场景中心；选中格显示独立近景、实时参数、阈值预警和已挂载组件占位。平原与梯田各为 5×5 格，净格宽 10m、田埂另占 0.4m；梯田以逐行泥面高程配置并按行设置挡水边；程序化稻株按格参数控制颜色、高度和稻穗显示，参数以 1 秒步长按天气做前端演示模拟，非传感器实测。此阶段场景结构由 Vue + Three.js 前端配置驱动，不新增 FastAPI 场景接口 |
| `/messages` | 消息中心 | 消息列表、筛选、点击展开并标已读、全部已读 |
| `/settings` | 个人设置 | 账号资料、农场信息、通知偏好开关、退出登录 |
| `/admin/dashboard` | 管理仪表盘 | 统计卡片、模块开发进度、最近活动 |
| `/admin/feedback` | 用户建议 | 建议列表、筛选、标记已处理 |
| `/admin/community` | 社区审核 | 待审核帖子、审核通过 |
| `/admin/users` | 用户管理 | 用户表格、启用/禁用、发送站内消息 |

## 模块负责人表

| 模块 | 负责人 | 状态 |
| ---- | ------ | ---- |
| 前端框架与双端交互（Vue 3 / Vue Router / api.js / store.js） | 同学 A | 基本完成 |
| 后端接口与数据契约（FastAPI / 内存假数据 / 鉴权） | 同学 A | 基本完成 |
| AI 病害识别模型（YOLO） | 同学 B | 训练中（当前返回示例数据） |
| 3D 场景与数据绑定（Three.js） | 同学 C | 程序化建模完成（9 类设备 + 土壤剖面） |

## 新增接口（本轮补全）

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| GET | `/api/detect/status` | 检查 ONNX 水稻病害分类模型是否可用 |
| POST | `/api/detect` | 上传图片并返回模型分类结果、置信度和人工复核建议 |
| GET | `/api/detect/library` | 水稻病害识别类别知识库（9 类） |
| POST | `/api/community/posts/{id}/like` | 点赞 / 取消点赞 |
| GET/POST | `/api/community/posts/{id}/comments` | 评论列表 / 发表评论 |
| GET | `/api/twin/state` | 设备控制状态 |
| GET | `/api/twin/weather?latitude={lat}&longitude={lon}` | 通过后端获取天气服务的当前天气与预报 |
| POST | `/api/twin/devices/{id}/toggle` | 设备控制（灌溉/通风/补光/卷帘） |
| GET | `/api/twin/soil-profile` | 四层土壤剖面与探针数据 |
| GET/PUT | `/api/user/profile` | 个人资料读取 / 更新 |

## 病害识别模型

- 后端使用 `model/rice_disease.onnx` 与 `model/labels.json`，按 `inference.py` 中的短边缩放、中心裁剪和 ImageNet 归一化预处理后执行 CPU 推理。
- 安装后端依赖：`pip install -r requirements.txt`；若替换模型，请确保输入为 `1x3x224x224`、输出类别数量与标签映射一致。
- 接口仅返回模型分类结果，不评估病害程度；诊断与防治信息用于参考，需结合田间情况复核。
- **3D 场景**：`src/scene/regionConfigs.ts` 管理地区、格子和独立参数配置；`src/scene/paddyFieldBuilder.js` 构建地形并挂载稻株批次。泥层和田埂使用静态 InstancedMesh 合并，减少地形 draw call。`src/scene/proceduralRiceFactory.js` 实现可替换的 `IPlantFactory` 兼容工厂，并使用轻量 Lambert 顶点色材质；`src/scene/riceInstanceBatches.js` 将种子、主茎、分蘖茎、叶片、穗轴/穗枝和谷粒分别建为全局 InstancedMesh，共享每格 140 个稳定索引槽位。单株 262 三角面，远景每格 60 株、中景 80 株、近景 100 株、选中格 140 株；成熟期会自动补回株数并加宽株形。萌芽期只显示种子，幼苗期叶片从中心逐步展开，分蘖、抽穗和谷粒按生理进度依次出现。全场容量约 183 万三角面。颜色和高度按生长阶段/健康值更新，叶穗通过实例可见属性控制并使用 GPU 风摆，不投射或接收实时阴影。`aVisible` 仍会执行隐藏实例的顶点处理，后续若需进一步降低移动设备负载，应实现真正按格拆分的批次 LOD。选中格的 `PlotCloseup.vue` 使用独立 renderer 和 24 株近景实例，并在参数变化时按需渲染。`farmComponents.js` 以纯逻辑管理插件及其每格唯一性，`farmComponentRates.js` 集中维护天气和组件速率；每秒 tick 将启用组件效果传入无 Three.js 依赖的 `plotSimulation.js`，模拟水位、CO₂ 和温度变化。组件模型由 `farmComponentVisualFactory.js` 独立生成；巡检摄像头和大朋 VR 使用可替换的几何体占位，`ivrMode.ts` 仅预留 `IVRMode` 接口，不接入运行时 VR。对应纯逻辑测试位于 `frontend/tests/riceInstanceBatches.test.js`、`frontend/tests/plotSimulation.test.js` 与 `frontend/tests/farmComponents.test.js`。

## 验收自检

- [x] 两条启动命令后打开 http://localhost:5173，跳转登录页，两个演示账号均可登录并进入对应端
- [x] 用户端顶部导航四个主页面可访问，视觉统一为 Apple 风格毛玻璃
- [x] 首页政策/股票/公告正常渲染，股票红涨绿跌
- [x] 社区可浏览、可发布、可点赞、可打开详情并发表评论
- [x] 病害识别支持批量上传（最多 5 张）、ONNX 水稻病害分类、模型状态提示、病害知识库与识别历史
- [x] 孪生平台的两个露天水田地块均显示 5×5 子区域，可点击子区域查看其独立默认参数
- [x] 平原和梯田配置使用同一 5×5 格结构；梯田高程按行配置，水面高度按子区域水位计算
- [x] 孪生场景使用自由旋转、平移和缩放；本阶段仅使用前端场景配置，不新增场景后端接口
- [x] 两块水田显示程序化稻株；全局五批次共享 7,000 个稳定索引槽位，生长阶段与健康值驱动稻株外观
- [x] 选中子区域后相机平滑聚焦，详情区显示独立稻株近景、动态参数、阈值预警与组件空状态
- [x] 田块参数按秒执行纯前端水位/CO₂ 演示模拟，模拟公式与 Three.js 场景隔离
- [x] 组件可按格挂载、启停和移除；摄像头支持巡检视角，VR 设备仅展示且不接入运行时
- [x] `npm --prefix .\frontend run test:rice` 通过水稻预算、哈希布局、索引区间和可见性逻辑测试
- [x] 个人设置可修改资料、农场信息与通知偏好并保存到后端
- [x] 消息中心可筛选、标记已读、未读数实时更新
- [x] 管理端四个页面可访问，建议处理、用户启停、发消息、帖子审核均可用
- [x] 普通用户无法访问 `/admin/*`，会跳回首页并提示无权限
- [x] 全站无默认 Vue 蓝白界面或组件库样式

## P1 天气双源 — 已知问题与 TODO

### 已知问题（本轮已接受，暂不修）

| # | 问题 | 影响范围 | 处理方式 |
|---|------|----------|----------|
| W1 | **实际天气直连 Open-Meteo**：部分网络环境（公司防火墙、校园网关、内网代理）可能拦截 `api.open-meteo.com` 导致请求失败 | 孪生操作界面 `/twin/studio` 的实际天气模式 | 前端已实现 10s 超时 + `ACTUAL_WEATHER_DEFAULTS`（固定晴天快照）降级 + UI 提示"实际天气暂不可用"。演示主推**模拟天气**（预设 4 档 + 5 滑块自定义） |
| W2 | **生产 `file://` 协议双击 dist/index.html**：浏览器对 `file://` origin 有限制，fetch 外部域可能被拒 | 任何部署在本地直接打开 dist 的场景 | 生产部署应通过 HTTP server（nginx / http-server / 后端代理）访问，而非 file:// 双击。`npm run dev` / `npm run preview` 均正常 |

### 本轮已落地（P1 完成）

- 新增 `frontend/src/scene/weatherState.js` — 天气快照单一真相源：三构建函数 + 视觉阈值
- 新增 `frontend/src/scene/weatherSource.js` — 实际天气抽象层（P1 直连 Open-Meteo，P1.5 只需改此文件切 FastAPI）
- 新增 `frontend/tests/weatherState.test.js` — 18 条零 three 依赖的纯逻辑测试
- 删除散落映射表：`WEATHER_PROFILES` / `WIND_SPEED_BY_WEATHER` / `weatherCodeMap` / `normalizeWeatherKey`，全部收进 weatherState.js
- TwinScene.vue 视觉效果改为数值阈值（`shouldShowRain` / `computeWindStrength`），不再硬编码 `weather === "rain"`

### TODO（P1.5 再处理，不阻塞）

| # | 内容 | 触发条件 |
|---|------|----------|
| Q1 | Open-Meteo 免费配额约 600 请求/分钟/IP，生产若多用户并发可能超限 → 建议 P1.5 迁 FastAPI 后由后端做 5 分钟级缓存（后端缓存跨用户/跨 IP 更省） | P1.5 后端启动、多用户测试时 |
| Q2 | P1.5 改 weatherSource 为调 FastAPI `/api/twin/weather` 时，若生产页面 HTTPS 而 FastAPI HTTP → 真混合内容拦截。届时二选一：① FastAPI HTTPS 部署；② 生产仍走 Open-Meteo 直连（后端只做内部业务 API） | P1.5 设计阶段，尚未定 |
