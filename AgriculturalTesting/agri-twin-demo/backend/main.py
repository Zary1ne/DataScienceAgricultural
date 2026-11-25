import json
from datetime import datetime
from typing import List, Optional
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

import data
from inference import InvalidImageError, ModelUnavailableError, model_info, predict

app = FastAPI(title="AgriTwin Demo Backend")

# 允许前端开发服务器 http://localhost:5173 跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def require_admin(request: Request):
    if request.headers.get("X-Role") != "admin":
        raise HTTPException(status_code=403, detail="无管理权限")


# —— 请求体模型 ——
class LoginBody(BaseModel):
    email: str
    password: str


class PostBody(BaseModel):
    title: str
    content: str
    tags: List[str] = []


class StatusBody(BaseModel):
    status: str


class SendMessageBody(BaseModel):
    userId: str
    title: str
    content: str


class CommentBody(BaseModel):
    content: str


class ToggleBody(BaseModel):
    key: str
    value: bool


class ProfileBody(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    farmName: Optional[str] = None
    location: Optional[str] = None
    area: Optional[float] = None
    crops: Optional[List[str]] = None
    notify: Optional[dict] = None


# ================= 认证 =================
@app.post("/api/auth/login")
def login(body: LoginBody):
    u = data.USERS.get(body.email)
    if not u or u["password"] != body.password:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    return {
        "token": "demo-token",
        "user": {"id": u["id"], "name": u["name"], "role": u["role"], "email": u["email"]},
    }


# ================= 首页 =================
@app.get("/api/home/news")
def home_news():
    return data.HOME_DATA


# ================= 社区 =================
@app.get("/api/community/posts")
def community_posts():
    return data.POSTS


@app.post("/api/community/posts")
def create_post(body: PostBody):
    post = {
        "id": f"c{len(data.POSTS) + 1}-{int(datetime.now().timestamp())}",
        "author": data.PROFILE["name"],
        "authorRole": "user",
        "avatar": data.PROFILE["name"][:1],
        "title": body.title,
        "content": body.content,
        "images": [],
        "tags": body.tags,
        "likes": 0,
        "comments": 0,
        "createdAt": now_str(),
        "source": "web",
    }
    data.POSTS.insert(0, post)
    data.POST_COMMENTS[post["id"]] = []
    return post


def _find_post(pid: str):
    for p in data.POSTS:
        if p["id"] == pid:
            return p
    raise HTTPException(status_code=404, detail="帖子不存在")


@app.post("/api/community/posts/{pid}/like")
def like_post(pid: str):
    post = _find_post(pid)
    if pid in data.POST_LIKED:
        data.POST_LIKED.discard(pid)
        post["likes"] = max(0, post["likes"] - 1)
    else:
        data.POST_LIKED.add(pid)
        post["likes"] += 1
    return {"ok": True, "likes": post["likes"], "liked": pid in data.POST_LIKED}


@app.get("/api/community/posts/{pid}/comments")
def post_comments(pid: str):
    return data.POST_COMMENTS.get(pid, [])


@app.post("/api/community/posts/{pid}/comments")
def add_comment(pid: str, body: CommentBody):
    post = _find_post(pid)
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="评论内容不能为空")
    comment = {
        "id": f"cm{int(datetime.now().timestamp() * 1000)}",
        "author": data.PROFILE["name"],
        "avatar": data.PROFILE["name"][:1],
        "content": content,
        "createdAt": now_str(),
    }
    data.POST_COMMENTS.setdefault(pid, []).append(comment)
    post["comments"] = len(data.POST_COMMENTS[pid])
    return {"ok": True, "comment": comment, "comments": post["comments"]}


# ================= 病害识别 =================
MAX_DETECT_IMAGE_BYTES = 5 * 1024 * 1024


@app.get("/api/detect/status")
def detect_status():
    try:
        info = model_info()
    except ModelUnavailableError as exc:
        return {"status": "unavailable", "message": str(exc)}
    return {"status": "ready", **info}


@app.post("/api/detect")
async def detect(file: UploadFile = File(...)):
    image_bytes = await file.read(MAX_DETECT_IMAGE_BYTES + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="请上传有效图片")
    if len(image_bytes) > MAX_DETECT_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="图片不能超过 5MB")

    try:
        predictions, inference_ms = await run_in_threadpool(predict, image_bytes, 1)
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    prediction = predictions[0]
    disease_info = next(
        (item for item in data.DETECT_LIBRARY if item["disease"] == prediction["label"]),
        None,
    )
    if disease_info is None:
        raise HTTPException(
            status_code=500,
            detail=f"模型类别“{prediction['label']}”缺少对应的诊断知识配置",
        )

    data.TODAY_DETECTIONS += 1
    result = {
        "disease": prediction["label"],
        "confidence": prediction["confidence"],
        "severity": disease_info["severity"],
        "symptoms": disease_info["symptoms"],
        "solution": disease_info["solution"],
    }
    record = {
        "id": f"h{int(datetime.now().timestamp() * 1000)}",
        "image": file.filename or f"image-{data.TODAY_DETECTIONS}.jpg",
        "disease": result["disease"],
        "confidence": result["confidence"],
        "severity": result["severity"],
        "time": now_str(),
    }
    data.DETECT_HISTORY.insert(0, record)
    del data.DETECT_HISTORY[100:]
    return {
        "model_status": "ready",
        "model_version": model_info()["version"],
        "inference_ms": inference_ms,
        "image_id": record["id"],
        "filename": record["image"],
        "results": [result],
    }


@app.get("/api/detect/history")
def detect_history():
    return data.DETECT_HISTORY


@app.get("/api/detect/library")
def detect_library():
    return data.DETECT_LIBRARY


# ================= 数字孪生 =================
@app.get("/api/twin/scene")
def twin_scene():
    return {"objects": data.SCENE_OBJECTS}


@app.get("/api/twin/overview")
def twin_overview():
    unread = sum(1 for m in data.MESSAGES if not m["isRead"])
    return {
        "plots": 6,
        "onlineDevices": 12,
        "todayDetections": data.TODAY_DETECTIONS,
        "unreadMessages": unread,
        "recentAlerts": data.RECENT_ALERTS,
    }


@app.get("/api/twin/state")
def twin_state():
    return data.TWIN_STATE


@app.get("/api/twin/weather")
def twin_weather(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    params = urlencode({
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
        "hourly": "temperature_2m,weather_code",
        "daily": "temperature_2m_max,temperature_2m_min",
        "forecast_days": 1,
        "timezone": "auto",
    })
    try:
        with urlopen(f"https://api.open-meteo.com/v1/forecast?{params}", timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="天气服务暂时不可用") from exc


@app.post("/api/twin/devices/{did}/toggle")
def twin_device_toggle(did: str, body: ToggleBody):
    obj = next((o for o in data.SCENE_OBJECTS if o["id"] == did), None)
    if not obj:
        raise HTTPException(status_code=404, detail="设备不存在")
    if body.key not in obj.get("controls", []):
        raise HTTPException(status_code=400, detail="不支持的控制项")
    if obj["type"] == "greenhouse":
        greenhouse_state = data.TWIN_STATE["greenhouses"].setdefault(
            did, {"ventilation": False, "lighting": False, "roller": False, "irrigation": False}
        )
        greenhouse_state[body.key] = body.value
    elif body.key == "irrigation":
        data.TWIN_STATE["irrigation"] = body.value
    return {"ok": True, "state": data.TWIN_STATE}


@app.get("/api/twin/soil-profile")
def twin_soil_profile():
    return data.SOIL_PROFILE


# ================= 个人资料 =================
@app.get("/api/user/profile")
def get_profile():
    return data.PROFILE


@app.put("/api/user/profile")
def update_profile(body: ProfileBody):
    patch = body.dict(exclude_none=True)
    data.PROFILE.update(patch)
    return data.PROFILE


# ================= 消息中心 =================
@app.get("/api/messages")
def messages():
    return data.MESSAGES


@app.post("/api/messages/read-all")
def messages_read_all():
    for m in data.MESSAGES:
        m["isRead"] = True
    return {"ok": True}


@app.post("/api/messages/{mid}/read")
def messages_read(mid: str):
    for m in data.MESSAGES:
        if m["id"] == mid:
            m["isRead"] = True
    return {"ok": True}


# ================= 管理端 =================
@app.get("/api/admin/dashboard")
def admin_dashboard(request: Request):
    require_admin(request)
    stats = {
        "totalUsers": 128,
        "todayDetections": data.TODAY_DETECTIONS,
        "communityPosts": len(data.POSTS),
        "pendingFeedback": sum(1 for f in data.FEEDBACK if f["status"] == "pending"),
    }
    return {
        "stats": stats,
        "moduleProgress": data.ADMIN_DASHBOARD["moduleProgress"],
        "recentActivities": data.ADMIN_DASHBOARD["recentActivities"],
    }


@app.get("/api/admin/feedback")
def admin_feedback(request: Request):
    require_admin(request)
    return data.FEEDBACK


@app.post("/api/admin/feedback/{fid}/handle")
def admin_feedback_handle(fid: str, request: Request):
    require_admin(request)
    for f in data.FEEDBACK:
        if f["id"] == fid:
            f["status"] = "handled"
    return {"ok": True}


@app.get("/api/admin/users")
def admin_users(request: Request):
    require_admin(request)
    return data.ADMIN_USERS


@app.post("/api/admin/users/{uid}/status")
def admin_user_status(uid: str, body: StatusBody, request: Request):
    require_admin(request)
    for u in data.ADMIN_USERS:
        if u["id"] == uid:
            u["status"] = body.status
    return {"ok": True}


@app.post("/api/admin/send-message")
def admin_send_message(body: SendMessageBody, request: Request):
    require_admin(request)
    msg = {
        "id": f"m{len(data.MESSAGES) + 1}-{int(datetime.now().timestamp())}",
        "type": "admin",
        "title": body.title,
        "content": body.content,
        "isRead": False,
        "createdAt": now_str(),
    }
    data.MESSAGES.insert(0, msg)
    return {"ok": True, "message": msg}


@app.get("/api/admin/community/posts")
def admin_community_posts(request: Request):
    require_admin(request)
    return data.ADMIN_COMMUNITY_POSTS


@app.post("/api/admin/community/posts/{pid}/approve")
def admin_community_approve(pid: str, request: Request):
    require_admin(request)
    for p in data.ADMIN_COMMUNITY_POSTS:
        if p["id"] == pid:
            p["status"] = "approved"
    return {"ok": True}
