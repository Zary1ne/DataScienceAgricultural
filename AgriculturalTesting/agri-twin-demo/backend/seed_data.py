# -*- coding: utf-8 -*-
"""首次启动时写入 MySQL 的演示种子数据。

仅在 users 表为空时导入一次，后续启动不会重复写入。
"""

# 所有演示账号的初始密码（数据库中保存的是 PBKDF2 哈希）
DEMO_PASSWORD = "demo123"

# —— 演示账号（合并原 USERS 与 ADMIN_USERS） ——
USERS = [
    {"id": "u1", "name": "张农户", "email": "user@demo.com", "role": "user", "status": "active", "createdAt": "2026-09-01", "lastLogin": "2026-11-04 10:20"},
    {"id": "u2", "name": "平台管理员", "email": "admin@demo.com", "role": "admin", "status": "active", "createdAt": "2026-08-15", "lastLogin": "2026-11-04 11:05"},
    {"id": "u3", "name": "李种植", "email": "li@demo.com", "role": "user", "status": "active", "createdAt": "2026-09-10", "lastLogin": "2026-11-03 09:30"},
    {"id": "u4", "name": "王农户", "email": "wang@demo.com", "role": "user", "status": "disabled", "createdAt": "2026-09-20", "lastLogin": "2026-10-25 14:00"},
    {"id": "u5", "name": "赵稻农", "email": "zhao@demo.com", "role": "user", "status": "active", "createdAt": "2026-10-01", "lastLogin": "2026-11-02 20:10"},
    {"id": "u6", "name": "孙农田", "email": "sun@demo.com", "role": "user", "status": "active", "createdAt": "2026-10-12", "lastLogin": "2026-11-04 08:00"},
]

# —— 个人资料 ——
PROFILE = {
    "name": "张农户",
    "email": "user@demo.com",
    "phone": "138****6688",
    "farmName": "洞庭湖水稻示范农场",
    "location": "湖南省岳阳市",
    "area": 38,
    "crops": ["水稻"],
    "notify": {"alert": True, "daily": True, "community": False},
}

# —— 社区帖子 ——
POSTS = [
    {
        "id": "c1",
        "author": "张农户",
        "authorRole": "user",
        "avatar": "张",
        "title": "水稻纹枯病防治经验分享",
        "content": "今年晚稻分蘖后期出现纹枯病病斑，通过排水晒田、控制氮肥用量并及时清理病残体，病情扩展明显放缓。防治用药时按当地植保部门建议和农药标签执行。",
        "images": [],
        "tags": ["水稻", "纹枯病", "病害防治"],
        "likes": 32,
        "comments": 8,
        "createdAt": "2026-11-01 14:20",
        "source": "web",
    },
    {
        "id": "c2",
        "author": "李种植",
        "authorRole": "user",
        "avatar": "李",
        "title": "稻田水肥一体化使用心得",
        "content": "水稻田采用水肥一体化后，追肥和灌水更均匀，关键是按生育期控制氮肥用量，并定期校准 EC 值和 pH 值。",
        "images": [],
        "tags": ["水稻", "水肥管理"],
        "likes": 18,
        "comments": 5,
        "createdAt": "2026-10-30 09:10",
        "source": "miniprogram",
    },
    {
        "id": "c3",
        "author": "平台管理员",
        "authorRole": "admin",
        "avatar": "管",
        "title": "平台使用指南：从上传图片到查看结果",
        "content": "进入「病害识别」页面，上传叶片图片后点击开始识别，即可查看诊断结果与防治建议。",
        "images": [],
        "tags": ["使用指南"],
        "likes": 45,
        "comments": 12,
        "createdAt": "2026-10-28 10:00",
        "source": "web",
    },
    {
        "id": "c4",
        "author": "王农户",
        "authorRole": "user",
        "avatar": "王",
        "title": "水稻叶片出现褐色条斑，是白叶枯病吗",
        "content": "近期晚稻叶片边缘出现黄白色条斑，早晨露水重时更明显，部分病斑沿叶脉扩展。请问需要优先排查白叶枯病还是细菌性条斑病？",
        "images": [],
        "tags": ["水稻", "白叶枯病", "求助"],
        "likes": 9,
        "comments": 15,
        "createdAt": "2026-10-26 20:30",
        "source": "miniprogram",
    },
    {
        "id": "c5",
        "author": "赵稻农",
        "authorRole": "user",
        "avatar": "赵",
        "title": "稻田水位与墒情传感器选型避坑指南",
        "content": "稻田传感器不能只看价格，重点看防水防腐、泥水环境稳定性和数据回传能力，水位与墒情传感器建议选用适合长期野外部署的工业级设备。",
        "images": [],
        "tags": ["水稻", "传感器", "田间管理"],
        "likes": 21,
        "comments": 6,
        "createdAt": "2026-10-24 11:00",
        "source": "web",
    },
    {
        "id": "c6",
        "author": "孙农田",
        "authorRole": "user",
        "avatar": "孙",
        "title": "丰收啦！分享我的晚稻收割日",
        "content": "这一季晚稻穗粒数和结实率都不错，多亏平台的水位、天气和生育期提醒，分享几张收割现场照片给大家。",
        "images": [],
        "tags": ["水稻", "丰收", "分享"],
        "likes": 56,
        "comments": 20,
        "createdAt": "2026-10-22 18:00",
        "source": "miniprogram",
    },
]

# —— 社区评论（按帖子 id 组织） ——
POST_COMMENTS = {
    "c1": [
        {"id": "cm1", "author": "李种植", "avatar": "李", "content": "纹枯病重点还是控氮、晒田和降低田间湿度；病斑扩展较快时，先请当地植保人员确认，再按标签用药。", "createdAt": "2026-11-01 16:02"},
        {"id": "cm2", "author": "王农户", "avatar": "王", "content": "补充一点：病残体要带出田外处理，进田操作后也要清洁工具，减少病菌传播。", "createdAt": "2026-11-01 19:20"},
    ],
    "c4": [
        {"id": "cm3", "author": "赵稻农", "avatar": "赵", "content": "白叶枯和细菌性条斑病要结合病斑形态和清晨菌脓判断，先别自行用药，拍清病健交界处后请植保员复核。", "createdAt": "2026-10-27 08:10"},
        {"id": "cm4", "author": "平台管理员", "avatar": "管", "content": "建议先在病害识别上传图片，查看系统给出的示例诊断与防治建议。", "createdAt": "2026-10-27 09:35"},
    ],
}

# —— 消息中心（顺序即展示顺序） ——
MESSAGES = [
    {"id": "m1", "type": "system", "title": "欢迎使用智慧农业数字孪生平台", "content": "欢迎注册！您可以浏览农业资讯、使用病害识别、体验数字孪生农场。", "isRead": True, "createdAt": "2026-11-01 09:00"},
    {"id": "m2", "type": "admin", "title": "水稻病害识别模型已接入", "content": "平台现已接入 ONNX 水稻病害分类模型；识别结果仅供参考，需结合田间情况复核。", "isRead": False, "createdAt": "2026-11-14 10:00"},
    {"id": "m3", "type": "system", "title": "平台 v0.9 版本更新公告", "content": "新增病害识别与共享社区功能，欢迎体验并提交反馈。", "isRead": False, "createdAt": "2026-11-03 11:00"},
    {"id": "m4", "type": "admin", "title": "关于农场数据接入的通知", "content": "请各位用户核对育秧棚与稻田环境传感器数据，如有异常请在社区或消息中心反馈。", "isRead": False, "createdAt": "2026-11-03 14:00"},
    {"id": "m5", "type": "system", "title": "系统维护通知", "content": "平台将于本周日凌晨 2:00-4:00 进行系统维护，期间部分功能暂不可用。", "isRead": True, "createdAt": "2026-10-28 20:00"},
    {"id": "m6", "type": "admin", "title": "欢迎参与社区内容共建", "content": "欢迎在共享社区发布种植经验与案例，共同建设农业知识社区。", "isRead": False, "createdAt": "2026-11-04 08:30"},
]

# —— 管理端：用户建议（顺序即展示顺序） ——
FEEDBACK = [
    {"id": "f1", "user": "张农户", "content": "希望病害识别能支持批量上传多张图片", "category": "功能建议", "status": "pending", "createdAt": "2026-11-02 10:00"},
    {"id": "f2", "user": "李种植", "content": "孪生平台的三维场景很直观，期待接入真实模型", "category": "体验反馈", "status": "pending", "createdAt": "2026-11-01 16:30"},
    {"id": "f3", "user": "王农户", "content": "手机端上传图片有点慢，建议压缩后再传", "category": "问题反馈", "status": "handled", "createdAt": "2026-10-30 09:00"},
    {"id": "f4", "user": "赵稻农", "content": "希望能增加水稻虫害识别", "category": "功能建议", "status": "pending", "createdAt": "2026-10-29 14:20"},
    {"id": "f5", "user": "孙农田", "content": "社区发帖后希望有审核进度提示", "category": "体验反馈", "status": "handled", "createdAt": "2026-10-28 11:00"},
]

