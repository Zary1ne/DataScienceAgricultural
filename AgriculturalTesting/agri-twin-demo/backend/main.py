import json
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

import data
import market
import repository as repo
from db import get_db, init_db
from inference import InvalidImageError, ModelUnavailableError, model_info, predict


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # 启动时建表；users 为空时写入一次演示种子数据
    init_db()
    yield


app = FastAPI(title="AgriTwin Demo Backend", lifespan=lifespan)

# 允许前端开发服务器 http://localhost:5173 跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 用户头像与帖子附件的本地存储目录
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
AVATAR_DIR = UPLOAD_DIR / "avatars"
POSTS_DIR = UPLOAD_DIR / "posts"
for _dir in (AVATAR_DIR, POSTS_DIR):
    _dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def current_user(request: Request, db: Session):
    """校验 X-Token 对应的会话，返回当前登录用户。"""
    user = repo.get_user_by_token(db, request.headers.get("X-Token"))
    if user is None:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
    return user


def optional_user(request: Request, db: Session):
    """有有效 token 时返回用户，否则返回 None（兼容未登录调用）。"""
    return repo.get_user_by_token(db, request.headers.get("X-Token"))


def require_admin(request: Request, db: Session):
    user = current_user(request, db)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="无管理权限")
    return user


# —— 请求体模型 ——
class LoginBody(BaseModel):
    email: str
    password: str


class RegisterBody(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class ChangePasswordBody(BaseModel):
    oldPassword: str
    newPassword: str


class FeedbackBody(BaseModel):
    content: str
    category: Optional[str] = "功能建议"


class PostBody(BaseModel):
    title: str
    content: str
    tags: List[str] = []


class EditPostBody(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None


class StatusBody(BaseModel):
    status: str


class UpdateUserBody(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


class ResetPasswordBody(BaseModel):
    password: str


class SendMessageBody(BaseModel):
    userId: Optional[str] = None
    title: str
    content: str


class CommentBody(BaseModel):
    content: str
    parentId: Optional[str] = None


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


class WatchlistBody(BaseModel):
    codes: List[str] = []


# —— 上传限制 ——
AVATAR_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
AVATAR_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_POST_FILE_BYTES = 5 * 1024 * 1024
MAX_POST_FILES = 10
MAX_README_BYTES = 200 * 1024
ALLOWED_POST_SUFFIXES = {
    ".md", ".markdown", ".txt", ".pdf", ".csv", ".json",
    ".png", ".jpg", ".jpeg", ".webp", ".gif",
    ".xlsx", ".xls", ".docx", ".doc", ".pptx", ".zip", ".rar",
}


def _remove_local_upload(url):
    """删除本地上传目录中的旧文件；外链或空值直接忽略。"""
    if not url or not url.startswith("/uploads/"):
        return
    target = UPLOAD_DIR / url[len("/uploads/"):]
    try:
        target.unlink(missing_ok=True)
    except OSError:
        pass


def _safe_filename(name):
    base = Path(name or "file").name
    base = re.sub(r"[^\w.\-\u4e00-\u9fff]+", "_", base).strip("._")
    return (base or "file")[:120]


def _build_readme(title, content, tags, attachments):
    lines = [f"# {title}", "", content, ""]
    if tags:
        lines += ["## 标签", "", " ".join(f"`{tag}`" for tag in tags), ""]
    if attachments:
        lines += ["## 附件", ""]
        for item in attachments:
            lines.append(f"- [{item['name']}]({item['url']})")
        lines.append("")
    lines += ["---", "", "> 本 README 由 AgriTwin 社区根据帖子内容自动生成。"]
    return "\n".join(lines)


# ================= 认证 =================
@app.post("/api/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = repo.authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    token = repo.create_session(db, user.id)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "email": user.email,
            "avatar": user.avatar or "",
        },
    }


@app.post("/api/auth/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    email = (body.email or "").strip().lower()
    password = body.password or ""
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="请输入有效邮箱")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码长度不能少于 6 位")
    user = repo.register_user(db, email, password, body.name)
    if user is None:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")
    token = repo.create_session(db, user.id)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "email": user.email,
            "avatar": user.avatar or "",
        },
    }


@app.get("/api/auth/me")
def auth_me(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return {
        "id": user.id,
        "name": user.name,
        "role": user.role,
        "email": user.email,
        "avatar": user.avatar or "",
    }


@app.post("/api/auth/logout")
def auth_logout(request: Request, db: Session = Depends(get_db)):
    repo.delete_session(db, request.headers.get("X-Token"))
    return {"ok": True}


@app.post("/api/auth/password")
def change_password(body: ChangePasswordBody, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    new_password = body.newPassword or ""
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码长度不能少于 6 位")
    if not repo.change_password(db, user, body.oldPassword or "", new_password):
        raise HTTPException(status_code=400, detail="原密码错误")
    # 修改密码后让其他设备下线，保留当前 token
    repo.delete_user_sessions(db, user.id, keep_token=request.headers.get("X-Token"))
    return {"ok": True}


@app.post("/api/auth/logout-all")
def logout_all(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    repo.delete_user_sessions(db, user.id)
    return {"ok": True}


# ================= 首页 =================
@app.get("/api/home/news")
def home_news():
    return data.HOME_DATA


# ================= 社区 =================
@app.get("/api/community/posts")
def community_posts(request: Request, db: Session = Depends(get_db)):
    user = optional_user(request, db)
    return repo.list_posts(db, user.id if user else None)


@app.post("/api/community/posts")
def create_post(body: PostBody, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return repo.create_post(
        db, body.title, body.content, body.tags, author=user.name, user_id=user.id, role=user.role
    )


@app.post("/api/community/posts/upload")
async def create_post_with_files(
    request: Request,
    title: str = Form(...),
    content: str = Form(...),
    tags: str = Form("[]"),
    readme: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
):
    """发布带附件/README 的帖子；文件保存在 uploads/posts 下。"""
    user = current_user(request, db)
    title = (title or "").strip()
    content = (content or "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能为空")

    try:
        tag_list = json.loads(tags) if tags else []
    except json.JSONDecodeError:
        tag_list = [item.strip() for item in tags.split(",") if item.strip()]
    if not isinstance(tag_list, list):
        tag_list = []

    uploads = [item for item in (files or []) if item and item.filename]
    if len(uploads) > MAX_POST_FILES:
        raise HTTPException(status_code=400, detail=f"附件不能超过 {MAX_POST_FILES} 个")

    post_id = repo.new_post_id(db)
    folder = POSTS_DIR / post_id
    attachments = []
    for item in uploads:
        suffix = Path(item.filename).suffix.lower()
        if suffix not in ALLOWED_POST_SUFFIXES:
            raise HTTPException(status_code=400, detail=f"不支持的附件类型：{suffix or '未知'}")
        payload = await item.read(MAX_POST_FILE_BYTES + 1)
        if len(payload) > MAX_POST_FILE_BYTES:
            raise HTTPException(status_code=413, detail="单个附件不能超过 5MB")
        folder.mkdir(parents=True, exist_ok=True)
        stored = _safe_filename(item.filename)
        target = folder / stored
        counter = 1
        while target.exists():
            target = folder / f"{Path(stored).stem}-{counter}{Path(stored).suffix}"
            counter += 1
        target.write_bytes(payload)
        attachments.append(
            {
                "name": Path(item.filename).name,
                "url": f"/uploads/posts/{post_id}/{target.name}",
                "size": len(payload),
            }
        )

    readme_text = ""
    if readme is not None and readme.filename:
        suffix = Path(readme.filename).suffix.lower()
        if suffix not in {".md", ".markdown", ".txt"}:
            raise HTTPException(status_code=400, detail="README 仅支持 .md / .txt")
        raw = await readme.read(MAX_README_BYTES + 1)
        if len(raw) > MAX_README_BYTES:
            raise HTTPException(status_code=413, detail="README 不能超过 200KB")
        readme_text = raw.decode("utf-8", errors="ignore")
    if not readme_text.strip():
        readme_text = _build_readme(title, content, tag_list, attachments)

    return repo.create_post(
        db,
        title,
        content,
        tag_list,
        author=user.name,
        user_id=user.id,
        role=user.role,
        post_id=post_id,
        attachments=attachments,
        readme=readme_text,
    )


@app.get("/api/community/posts/{pid}")
def community_post_detail(pid: str, request: Request, db: Session = Depends(get_db)):
    user = optional_user(request, db)
    post = repo.get_post(db, pid)
    if post is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    if post.status != "approved" and not (
        user and (user.id == post.user_id or user.role == "admin")
    ):
        raise HTTPException(status_code=404, detail="帖子不存在")
    return repo.get_post_detail(db, pid, user.id if user else None)


@app.post("/api/community/posts/{pid}/like")
def like_post(pid: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    result = repo.toggle_like(db, pid, user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return result


@app.get("/api/community/posts/{pid}/comments")
def post_comments(pid: str, request: Request, db: Session = Depends(get_db)):
    user = optional_user(request, db)
    return repo.list_comments(db, pid, user.id if user else None)


@app.post("/api/community/posts/{pid}/comments")
def add_comment(pid: str, body: CommentBody, request: Request, db: Session = Depends(get_db)):
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="评论内容不能为空")
    user = current_user(request, db)
    result = repo.add_comment(
        db,
        pid,
        content,
        author=user.name,
        user_id=user.id,
        parent_id=body.parentId,
    )
    if result is None:
        raise HTTPException(status_code=400, detail="帖子或回复目标不存在")
    return result


@app.post("/api/community/comments/{cid}/like")
def like_comment(cid: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    result = repo.toggle_comment_like(db, cid, user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="评论不存在")
    return result


@app.patch("/api/community/posts/{pid}")
def edit_post(
    pid: str, body: EditPostBody, request: Request, db: Session = Depends(get_db)
):
    user = current_user(request, db)
    post = repo.get_post(db, pid)
    if post is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己发布的帖子")
    title = body.title.strip() if body.title is not None else None
    content = body.content.strip() if body.content is not None else None
    if title is not None and not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    if content is not None and not content:
        raise HTTPException(status_code=400, detail="内容不能为空")
    return repo.update_post(db, post, title, content, body.tags)


@app.delete("/api/community/posts/{pid}")
def remove_post(pid: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    post = repo.get_post(db, pid)
    if post is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    if post.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="无权删除该帖子")
    repo.delete_post(db, post)
    return {"ok": True}


@app.post("/api/community/posts/{pid}/favorite")
def favorite_post(pid: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    result = repo.add_favorite(db, pid, user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return result


@app.delete("/api/community/posts/{pid}/favorite")
def unfavorite_post(pid: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    result = repo.remove_favorite(db, pid, user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return result


@app.delete("/api/community/comments/{cid}")
def remove_comment(cid: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    comment = repo.get_comment(db, cid)
    if comment is None:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="无权删除该评论")
    repo.delete_comment(db, comment)
    return {"ok": True}


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
async def detect(
    request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    user = current_user(request, db)
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

    record = repo.add_detect_record(
        db,
        file.filename,
        prediction["label"],
        prediction["confidence"],
        disease_info["severity"],
        user_id=user.id,
    )
    result = {
        "disease": prediction["label"],
        "confidence": prediction["confidence"],
        "severity": disease_info["severity"],
        "symptoms": disease_info["symptoms"],
        "solution": disease_info["solution"],
    }
    return {
        "model_status": "ready",
        "model_version": model_info()["version"],
        "inference_ms": inference_ms,
        "image_id": record["id"],
        "filename": record["image"],
        "results": [result],
    }


@app.get("/api/detect/history")
def detect_history(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return repo.list_detect_history(db, user.id)


@app.delete("/api/detect/history/{hid}")
def delete_detect_history(hid: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    if not repo.delete_detect_record(db, hid, user.id):
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"ok": True}


@app.delete("/api/detect/history")
def clear_detect_history(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    repo.clear_detect_history(db, user.id)
    return {"ok": True}


@app.get("/api/detect/library")
def detect_library():
    return data.DETECT_LIBRARY


# ================= 数字孪生 =================
@app.get("/api/twin/scene")
def twin_scene():
    return {"objects": data.SCENE_OBJECTS}


@app.get("/api/twin/overview")
def twin_overview(request: Request, db: Session = Depends(get_db)):
    user = optional_user(request, db)
    return {
        "plots": 6,
        "onlineDevices": 12,
        "todayDetections": repo.count_today_detections(db),
        "unreadMessages": repo.count_unread_messages(db, user.id if user else None),
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
def get_profile(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return repo.get_profile(db, user.email)


@app.put("/api/user/profile")
def update_profile(body: ProfileBody, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return repo.update_profile(db, user.email, body.dict(exclude_none=True))


@app.post("/api/user/avatar")
async def upload_avatar(
    request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    user = current_user(request, db)
    suffix = AVATAR_TYPES.get((file.content_type or "").lower())
    if suffix is None:
        named = Path(file.filename or "").suffix.lower()
        if named not in AVATAR_SUFFIXES:
            raise HTTPException(status_code=400, detail="头像仅支持 JPG / PNG / WebP")
        suffix = ".jpg" if named == ".jpeg" else named
    payload = await file.read(MAX_AVATAR_BYTES + 1)
    if not payload:
        raise HTTPException(status_code=400, detail="请上传有效图片")
    if len(payload) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="头像不能超过 2MB")

    stored = f"{user.id}-{int(time.time() * 1000)}{suffix}"
    (AVATAR_DIR / stored).write_bytes(payload)
    result = repo.set_user_avatar(db, user.id, f"/uploads/avatars/{stored}")
    _remove_local_upload(result["previous"])
    return {"ok": True, "avatarUrl": result["avatarUrl"]}


@app.delete("/api/user/avatar")
def reset_avatar(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    result = repo.set_user_avatar(db, user.id, "")
    _remove_local_upload(result["previous"])
    return {"ok": True, "avatarUrl": ""}


# ================= 消息中心 =================
@app.get("/api/messages")
def messages(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return repo.list_messages(db, user.id)


@app.post("/api/messages/read-all")
def messages_read_all(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    repo.mark_all_read(db, user.id)
    return {"ok": True}


@app.post("/api/messages/{mid}/read")
def messages_read(mid: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    repo.mark_read(db, mid, user.id)
    return {"ok": True}


# ================= 用户反馈 =================
@app.get("/api/feedback/mine")
def my_feedback(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return repo.list_user_feedback(db, user.id)


@app.post("/api/feedback")
def submit_feedback(body: FeedbackBody, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="反馈内容不能为空")
    if len(content) > 1000:
        raise HTTPException(status_code=400, detail="反馈内容不能超过 1000 字")
    return repo.add_feedback(db, user, body.category, content)


# ================= 管理端 =================
@app.get("/api/admin/dashboard")
def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    stats = {
        "totalUsers": repo.count_users(db),
        "todayDetections": repo.count_today_detections(db),
        "communityPosts": repo.count_posts(db),
        "pendingFeedback": repo.count_pending_feedback(db),
    }
    return {
        "stats": stats,
        "moduleProgress": data.ADMIN_DASHBOARD["moduleProgress"],
        "recentActivities": data.ADMIN_DASHBOARD["recentActivities"],
    }


@app.get("/api/admin/feedback")
def admin_feedback(request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    return repo.list_feedback(db)


@app.post("/api/admin/feedback/{fid}/handle")
def admin_feedback_handle(fid: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    repo.handle_feedback(db, fid)
    return {"ok": True}


@app.get("/api/admin/users")
def admin_users(request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    return repo.list_users(db)


@app.patch("/api/admin/users/{uid}")
def admin_update_user(
    uid: str,
    body: UpdateUserBody,
    request: Request,
    db: Session = Depends(get_db),
):
    admin = require_admin(request, db)
    if uid == admin.id:
        raise HTTPException(status_code=400, detail="不能修改自己的角色或状态")
    user = repo.update_user(db, uid, body.role, body.status)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@app.post("/api/admin/users/{uid}/status")
def admin_user_status(
    uid: str,
    body: StatusBody,
    request: Request,
    db: Session = Depends(get_db),
):
    admin = require_admin(request, db)
    if uid == admin.id:
        raise HTTPException(status_code=400, detail="不能修改自己的角色或状态")
    user = repo.update_user(db, uid, status=body.status)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"ok": True}


@app.post("/api/admin/users/{uid}/reset-password")
def admin_reset_password(
    uid: str,
    body: ResetPasswordBody,
    request: Request,
    db: Session = Depends(get_db),
):
    require_admin(request, db)
    password = body.password or ""
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码长度不能少于 6 位")
    if not repo.reset_user_password(db, uid, password):
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"ok": True}


@app.post("/api/admin/send-message")
def admin_send_message(
    body: SendMessageBody,
    request: Request,
    db: Session = Depends(get_db),
):
    require_admin(request, db)
    title = (body.title or "").strip()
    content = (body.content or "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能为空")
    target = (body.userId or "").strip() or None
    if target and repo.get_user(db, target) is None:
        raise HTTPException(status_code=404, detail="目标用户不存在")
    message = repo.add_message(db, title, content, target_user_id=target)
    return {"ok": True, "message": message}


@app.get("/api/admin/community/posts")
def admin_community_posts(request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    return repo.list_pending_posts(db)


@app.post("/api/admin/community/posts/{pid}/approve")
def admin_community_approve(pid: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    repo.approve_post(db, pid)
    return {"ok": True}


# ================= 行情终端 =================
@app.get("/api/market/overview")
def market_overview(request: Request, db: Session = Depends(get_db)):
    user = optional_user(request, db)
    codes = repo.get_watchlist(db, user.email) if user else None
    try:
        return market.get_overview(codes)
    except market.MarketError as exc:
        raise HTTPException(status_code=502, detail="行情数据获取失败，请稍后重试") from exc


@app.get("/api/market/kline")
def market_kline(code: str = Query(...)):
    code = (code or "").strip()
    if code not in market.KLINE_CODES:
        raise HTTPException(status_code=400, detail="不支持的股票代码")
    try:
        return market.get_kline(code)
    except market.MarketError as exc:
        raise HTTPException(status_code=502, detail="K 线数据获取失败，请稍后重试") from exc


@app.get("/api/market/pool")
def market_pool():
    return {"stocks": market.get_pool()}


@app.get("/api/market/watchlist")
def get_market_watchlist(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    codes = repo.get_watchlist(db, user.email) or list(market.DEFAULT_WATCHLIST)
    return {"codes": codes, "max": market.MAX_WATCHLIST}


@app.put("/api/market/watchlist")
def save_market_watchlist(
    body: WatchlistBody, request: Request, db: Session = Depends(get_db)
):
    user = current_user(request, db)
    codes = []
    for code in body.codes:
        code = str(code or "").strip()
        if code in market.POOL and code not in codes:
            codes.append(code)
    if not codes:
        raise HTTPException(status_code=400, detail="请至少选择一只股票")
    if len(codes) > market.MAX_WATCHLIST:
        raise HTTPException(
            status_code=400, detail=f"最多选择 {market.MAX_WATCHLIST} 只股票"
        )
    repo.set_watchlist(db, user.email, codes)
    return {"codes": codes, "max": market.MAX_WATCHLIST}


# ================= 单端口部署：托管前端构建产物 =================
DIST_DIR = (Path(__file__).resolve().parent.parent / "frontend" / "dist").resolve()

if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """SPA 兜底：静态文件优先，其余路径返回 index.html 交给前端路由。"""
        if full_path.startswith(("api/", "uploads/")):
            raise HTTPException(status_code=404, detail="资源不存在")
        target = (DIST_DIR / full_path).resolve()
        if DIST_DIR not in target.parents and target != DIST_DIR:
            raise HTTPException(status_code=404, detail="资源不存在")
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(DIST_DIR / "index.html")
