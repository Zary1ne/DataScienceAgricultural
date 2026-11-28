# -*- coding: utf-8 -*-
"""静态演示配置：首页资讯、孪生场景、土壤剖面、病害知识库与管理端静态文案。

可变业务数据（用户、帖子、评论、消息、反馈、识别历史）已迁移到 MySQL，
由 db.py 建表与写入种子数据，repository.py 负责读写。
"""

# —— 首页数据 ——
HOME_DATA = {
    "policies": [
        {
            "id": "p1",
            "title": "2026年中央一号文件发布，聚焦智慧农业",
            "summary": "文件提出加快农业数字化改造，推进数字孪生农场试点，建设一批智慧农业示范基地。",
            "date": "2026-10-25",
            "source": "农业农村部",
        },
        {
            "id": "p2",
            "title": "农业农村部发布《数字农业建设指南》",
            "summary": "指南明确设施农业、大田种植等场景的数字化建设标准与数据接口规范。",
            "date": "2026-10-20",
            "source": "农业农村部",
        },
        {
            "id": "p3",
            "title": "多地启动设施农业数字化补贴申报",
            "summary": "多个省份对购置智能传感器、水肥一体机等设备给予最高 30% 补贴。",
            "date": "2026-10-15",
            "source": "地方政府",
        },
    ],
    "stocks": [
        {"code": "000998", "name": "隆平高科", "price": 18.35, "change": 1.25, "changePercent": 7.31},
        {"code": "002385", "name": "大北农", "price": 6.82, "change": -0.15, "changePercent": -2.15},
        {"code": "600598", "name": "北大荒", "price": 12.44, "change": 0.32, "changePercent": 2.64},
        {"code": "300087", "name": "荃银高科", "price": 9.78, "change": 0.45, "changePercent": 4.82},
    ],
    "announcements": [
        {"id": "a1", "title": "平台 v0.9 版本上线：新增病害识别与社区功能", "date": "2026-11-01"},
        {"id": "a2", "title": "水稻病害识别模型服务已接入", "date": "2026-11-14"},
    ],
}

# —— 孪生场景对象（坐标单位：米） ——
# controls 表示该场景对象可以独立操作的控制项
SCENE_OBJECTS = [
    {
        "id": "greenhouse_1",
        "name": "1号育秧棚",
        "type": "greenhouse",
        "position": [-6.5, 0, -9],
        "status": "warning",
        "device": True,
        "controls": ["ventilation", "lighting", "roller", "irrigation"],
        "desc": "早稻育秧示范棚，重点监测春季低温阴雨与棚内高湿，配置独立通风、补光和卷帘控制。",
        "metrics": [
            {"label": "棚内温度", "value": "26.4", "unit": "°C"},
            {"label": "空气湿度", "value": "71", "unit": "%RH"},
            {"label": "CO₂ 浓度", "value": "412", "unit": "ppm"},
            {"label": "光照强度", "value": "18.6", "unit": "klx"},
        ],
    },
    {
        "id": "greenhouse_2",
        "name": "2号育秧棚",
        "type": "greenhouse",
        "position": [6.5, 0, -9],
        "status": "normal",
        "device": True,
        "controls": ["ventilation", "lighting", "roller", "irrigation"],
        "desc": "中晚稻育秧示范棚，独立监测温湿度，通风、补光和卷帘状态不与1号棚联动。",
        "metrics": [
            {"label": "棚内温度", "value": "24.1", "unit": "°C"},
            {"label": "空气湿度", "value": "68", "unit": "%RH"},
            {"label": "CO₂ 浓度", "value": "398", "unit": "ppm"},
            {"label": "光照强度", "value": "16.2", "unit": "klx"},
        ],
    },
    {
        "id": "field_1",
        "name": "A区大田",
        "type": "field",
        "position": [-6, 0, 6],
        "status": "normal",
        "device": False,
        "controls": ["irrigation"],
        "desc": "水稻本田示范田，配置田间水位与墒情监测。",
        "metrics": [
            {"label": "土壤墒情", "value": "62.4", "unit": "%"},
            {"label": "土壤温度", "value": "18.6", "unit": "°C"},
            {"label": "电导率 EC", "value": "1.32", "unit": "mS/cm"},
            {"label": "土壤 pH", "value": "6.8", "unit": ""},
        ],
    },
    {
        "id": "field_2",
        "name": "B区大田",
        "type": "field",
        "position": [9, 0, 6],
        "status": "normal",
        "device": False,
        "controls": ["irrigation"],
        "desc": "水稻本田示范田，配备独立灌溉支管与墒情传感器。",
        "metrics": [
            {"label": "土壤墒情", "value": "58.7", "unit": "%"},
            {"label": "土壤温度", "value": "19.2", "unit": "°C"},
            {"label": "电导率 EC", "value": "1.18", "unit": "mS/cm"},
            {"label": "土壤 pH", "value": "7.1", "unit": ""},
        ],
    },
    {
        "id": "weather_1",
        "name": "田间气象站",
        "type": "weatherStation",
        "position": [18, 0, -15],
        "status": "normal",
        "device": True,
        "controls": [],
        "desc": "采集风速、风向、降雨量、辐射与温湿度，5 分钟上传一次数据。",
        "metrics": [
            {"label": "风速", "value": "2.4", "unit": "m/s"},
            {"label": "风向", "value": "东南", "unit": ""},
            {"label": "降雨量", "value": "0.8", "unit": "mm"},
            {"label": "太阳辐射", "value": "468", "unit": "W/m²"},
        ],
    },
    {
        "id": "sensor_1",
        "name": "A区墒情传感器",
        "type": "soilSensor",
        "position": [-2.2, 0, 9],
        "status": "normal",
        "device": True,
        "controls": [],
        "desc": "三层土壤水分温度探针，埋深 10/20/30cm。",
        "metrics": [
            {"label": "10cm 含水率", "value": "62.4", "unit": "%"},
            {"label": "20cm 含水率", "value": "58.1", "unit": "%"},
            {"label": "30cm 温度", "value": "17.4", "unit": "°C"},
            {"label": "电量", "value": "86", "unit": "%"},
        ],
    },
    {
        "id": "sensor_2",
        "name": "B区墒情传感器",
        "type": "soilSensor",
        "position": [6, 0, 10],
        "status": "warning",
        "device": True,
        "controls": [],
        "desc": "三层土壤水分温度探针，电量偏低需巡检。",
        "metrics": [
            {"label": "10cm 含水率", "value": "48.2", "unit": "%"},
            {"label": "20cm 含水率", "value": "51.6", "unit": "%"},
            {"label": "30cm 温度", "value": "18.9", "unit": "°C"},
            {"label": "电量", "value": "23", "unit": "%"},
        ],
    },
    {
        "id": "pump_1",
        "name": "水肥一体泵房",
        "type": "pumpHouse",
        "position": [-18, 0, -2],
        "status": "normal",
        "device": True,
        "controls": ["irrigation"],
        "desc": "灌溉首部枢纽，含水泵、过滤、施肥与 EC/pH 在线调节。",
        "metrics": [
            {"label": "出水压力", "value": "0.32", "unit": "MPa"},
            {"label": "瞬时流量", "value": "18.5", "unit": "m³/h"},
            {"label": "EC 值", "value": "1.32", "unit": "mS/cm"},
            {"label": "pH 值", "value": "6.8", "unit": ""},
        ],
    },
    {
        "id": "tank_1",
        "name": "蓄水池",
        "type": "waterTank",
        "position": [-18, 0, -9],
        "status": "normal",
        "device": True,
        "controls": [],
        "desc": "50m³ 蓄水罐，配套液位与浊度监测。",
        "metrics": [
            {"label": "液位", "value": "72", "unit": "%"},
            {"label": "浊度", "value": "3.1", "unit": "NTU"},
            {"label": "水温", "value": "16.8", "unit": "°C"},
            {"label": "今日补水量", "value": "12.4", "unit": "m³"},
        ],
    },
    {
        "id": "solar_1",
        "name": "光伏供电阵列",
        "type": "solarArray",
        "position": [16, 0, 2],
        "status": "normal",
        "device": True,
        "controls": [],
        "desc": "离网光伏阵列，为墒情与气象设备供电。",
        "metrics": [
            {"label": "实时功率", "value": "3.8", "unit": "kW"},
            {"label": "今日发电", "value": "19.6", "unit": "kWh"},
            {"label": "电池电量", "value": "88", "unit": "%"},
            {"label": "组件温度", "value": "41.2", "unit": "°C"},
        ],
    },
    {
        "id": "camera_1",
        "name": "高清巡检摄像头",
        "type": "cameraPole",
        "position": [0, 0, -17],
        "status": "normal",
        "device": True,
        "controls": [],
        "desc": "400 万像素云台球机，支持 355° 巡航与病害巡检抓拍。",
        "metrics": [
            {"label": "分辨率", "value": "2560×1440", "unit": ""},
            {"label": "码率", "value": "2.4", "unit": "Mbps"},
            {"label": "存储占用", "value": "61", "unit": "%"},
            {"label": "在线时长", "value": "99.6", "unit": "%"},
        ],
    },
    {
        "id": "irrigation_1",
        "name": "B区喷灌机组",
        "type": "irrigation",
        "position": [9, 0, 6],
        "status": "normal",
        "device": True,
        "controls": ["irrigation"],
        "desc": "四喷头旋转喷灌，覆盖半径 4.4m，可与墒情阈值联动。",
        "metrics": [
            {"label": "喷头数量", "value": "4", "unit": "个"},
            {"label": "工作压力", "value": "0.28", "unit": "MPa"},
            {"label": "单次灌溉", "value": "25", "unit": "min"},
            {"label": "覆盖半径", "value": "4.4", "unit": "m"},
        ],
    },
]

# —— 孪生设备控制状态（运行时状态，进程内保存；育秧棚设备分棚保存） ——
TWIN_STATE = {
    "irrigation": False,
    "greenhouses": {
        "greenhouse_1": {"ventilation": False, "lighting": False, "roller": False, "irrigation": False},
        "greenhouse_2": {"ventilation": False, "lighting": False, "roller": False, "irrigation": False},
    },
}

# —— 土壤剖面（用于 3D 剖面模型与侧栏可视化） ——
SOIL_PROFILE = {
    "plot": "A区大田",
    "totalDepth": 220,
    "layers": [
        {"name": "耕作层（表土）", "from": 0, "to": 30, "texture": "壤土", "moisture": 62.4, "temp": 18.6, "ph": 6.8, "organic": "2.4%", "color": "#6f5537"},
        {"name": "黏土层", "from": 30, "to": 90, "texture": "黏壤", "moisture": 58.1, "temp": 17.4, "ph": 6.6, "organic": "0.9%", "color": "#a87b45"},
        {"name": "砂土层", "from": 90, "to": 160, "texture": "砂壤", "moisture": 46.2, "temp": 16.1, "ph": 6.9, "organic": "0.3%", "color": "#c3a16b"},
        {"name": "砾石层", "from": 160, "to": 220, "texture": "砾质", "moisture": 32.5, "temp": 15.2, "ph": 7.2, "organic": "0.1%", "color": "#86898b"},
    ],
    "sensors": [
        {"label": "表层探针", "depth": "10cm", "moisture": 62.4, "temp": 18.6},
        {"label": "中层探针", "depth": "20cm", "moisture": 58.1, "temp": 17.4},
        {"label": "深层探针", "depth": "30cm", "moisture": 51.6, "temp": 16.8},
    ],
}

# —— 水稻病害识别类别知识库（供人工复核参考） ——
DETECT_LIBRARY = [
    {"id": "d1", "crop": "水稻", "disease": "健康", "severity": "无", "symptoms": "模型未识别到已知类别中的明显病害特征。", "solution": "仍需结合田间巡查，持续观察叶片、茎秆和穗部变化。", "color": "#34c759"},
    {"id": "d2", "crop": "水稻", "disease": "其他病害", "severity": "待评估", "symptoms": "图像特征不属于模型训练的具体病害类别。", "solution": "建议拍摄清晰的病健交界处并请农技人员复核，不要仅凭本结果用药。", "color": "#ff9f0a"},
    {"id": "d3", "crop": "水稻", "disease": "白叶枯病", "severity": "待评估", "symptoms": "叶片常见沿叶缘或叶脉扩展的黄白色条斑，潮湿时病斑可能扩大。", "solution": "加强田间巡查，减少病株及带菌残体传播；确需防治时按当地植保部门建议和农药标签执行。", "color": "#ff9f0a"},
    {"id": "d4", "crop": "水稻", "disease": "稻瘟病", "severity": "待评估", "symptoms": "叶片可见梭形病斑，常有灰白色中心和褐色边缘。", "solution": "及时调查病株分布并关注田间湿度；防治措施按当地植保预警及农药标签执行。", "color": "#ff9f0a"},
    {"id": "d5", "crop": "水稻", "disease": "穗颈瘟", "severity": "待评估", "symptoms": "穗颈或枝梗可能出现褐色坏死，受害穗部易出现白穗。", "solution": "重点检查抽穗期田块并及时咨询当地农技人员，结合生育期和植保预警制定措施。", "color": "#ff9f0a"},
    {"id": "d6", "crop": "水稻", "disease": "纹枯病", "severity": "待评估", "symptoms": "叶鞘近水面处可出现椭圆形灰绿斑，后期边缘褐色并向上扩展。", "solution": "加强田间通风透光和病情监测；需要防治时遵照当地植保指导及农药标签。", "color": "#ff9f0a"},
    {"id": "d7", "crop": "水稻", "disease": "细菌性条斑病", "severity": "待评估", "symptoms": "叶片可能出现沿叶脉延伸的细窄半透明条斑，湿润时可见菌脓。", "solution": "避免带露水操作造成传播，及时清理病残体，并向当地植保部门核实防控方案。", "color": "#ff9f0a"},
    {"id": "d8", "crop": "水稻", "disease": "胡麻叶斑病", "severity": "待评估", "symptoms": "叶片可见散生的褐色小斑，形状近圆形或椭圆形。", "solution": "结合田间表现核实诊断，保持合理肥水管理；防治方案以当地植保建议为准。", "color": "#ff9f0a"},
    {"id": "d9", "crop": "水稻", "disease": "虫害", "severity": "待评估", "symptoms": "模型识别到可能的虫害图像特征，但无法仅凭分类结果确定具体虫种。", "solution": "检查叶片正反面及田间虫口，确认虫种和发生程度后再按当地指导采取综合防治。", "color": "#ff9f0a"},
]

RECENT_ALERTS = [
    {"id": "al1", "text": "1号育秧棚低温高湿，立枯/绵腐风险上升", "time": "2026-11-04 09:30"},
    {"id": "al2", "text": "A区大田 土壤湿度偏低，建议及时灌溉", "time": "2026-11-03 18:10"},
    {"id": "al3", "text": "2号育秧棚 环境传感器离线，请检查网络", "time": "2026-11-03 08:00"},
]

# —— 管理端：仪表盘静态文案 ——
ADMIN_DASHBOARD = {
    "moduleProgress": [
        {"name": "PC 大屏前端", "owner": "同学 A", "progress": 80, "status": "进行中"},
        {"name": "小程序端", "owner": "同学 A", "progress": 60, "status": "进行中"},
        {"name": "后端 API", "owner": "同学 A", "progress": 90, "status": "基本完成"},
        {"name": "AI 病害识别模型", "owner": "同学 B", "progress": 40, "status": "训练中"},
        {"name": "3D 场景与数据绑定", "owner": "同学 C", "progress": 55, "status": "进行中"},
    ],
    "recentActivities": [
        {"time": "2026-11-04 10:20", "text": "用户 张农户 提交了一条病害识别"},
        {"time": "2026-11-04 09:15", "text": "管理员 平台管理员 发布了系统公告"},
        {"time": "2026-11-03 16:40", "text": "用户 李种植 在社区发布了新帖子"},
        {"time": "2026-11-03 14:05", "text": "用户 王农户 提交了用户建议"},
        {"time": "2026-11-03 10:30", "text": "系统自动巡检：2号育秧棚传感器离线告警"},
        {"time": "2026-11-02 18:00", "text": "用户 赵稻农 完成了一次病害识别"},
    ],
}
