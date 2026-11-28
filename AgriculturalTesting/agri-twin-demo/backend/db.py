# -*- coding: utf-8 -*-
"""MySQL 连接、ORM 模型与初始化（建表 + 首次种子数据）。

连接参数从 backend/.env 读取，禁止把真实密码写进代码或提交到 git。
"""
import hashlib
import hmac
import os
import secrets
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    JSON,
    String,
    Text,
    create_engine,
    func,
    inspect,
    select,
    text,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().with_name(".env"))
except ImportError:  # 未安装 python-dotenv 时仍支持系统环境变量
    pass

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "agri_twin")
DB_USER = os.getenv("DB_USER", "agri_app")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

if not DB_PASSWORD:
    raise RuntimeError(
        "缺少数据库密码：请在 backend/.env 中设置 DB_PASSWORD（可参考 .env.example）"
    )

DATABASE_URL = (
    f"mysql+pymysql://{quote_plus(DB_USER)}:{quote_plus(DB_PASSWORD)}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=5,
    max_overflow=10,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# ================= ORM 模型 =================
class User(Base):
    __tablename__ = "users"

    id = Column(String(32), primary_key=True)
    email = Column(String(190), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(80), nullable=False)
    role = Column(String(16), nullable=False, default="user")
    status = Column(String(16), nullable=False, default="active")
    # 上传头像的相对地址；为空时前端按用户 ID 生成像素默认头像
    avatar = Column(String(255), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    last_login = Column(DateTime, nullable=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    email = Column(String(190), primary_key=True)
    name = Column(String(80), nullable=False)
    phone = Column(String(32), default="")
    farm_name = Column(String(120), default="")
    location = Column(String(120), default="")
    area = Column(Float, default=0)
    crops = Column(JSON, default=list)
    notify = Column(JSON, default=dict)
    # 用户自选的农业股代码列表
    watchlist = Column(JSON, default=list)


class AuthSession(Base):
    """登录会话：token 作为主键，过期后由后端清理。"""

    __tablename__ = "sessions"

    token = Column(String(64), primary_key=True)
    user_id = Column(String(32), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    expires_at = Column(DateTime, nullable=False, index=True)


class Post(Base):
    __tablename__ = "posts"

    id = Column(String(48), primary_key=True)
    user_id = Column(String(32), nullable=True, index=True)
    author = Column(String(80), nullable=False)
    author_role = Column(String(16), nullable=False, default="user")
    avatar = Column(String(8), default="")
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    images = Column(JSON, default=list)
    tags = Column(JSON, default=list)
    likes = Column(Integer, nullable=False, default=0)
    comments_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.now, index=True)
    source = Column(String(32), default="web")
    status = Column(String(16), nullable=False, default="approved", index=True)
    # 帖子附件与 README 正文（Markdown）
    attachments = Column(JSON, default=list)
    readme = Column(Text, nullable=True)


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(String(48), primary_key=True)
    post_id = Column(String(48), nullable=False, index=True)
    user_id = Column(String(32), nullable=True, index=True)
    author = Column(String(80), nullable=False)
    avatar = Column(String(8), default="")
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    # 二级回复：指向同帖下的父评论，顶级评论为空
    parent_id = Column(String(48), nullable=True, index=True)
    likes = Column(Integer, nullable=False, default=0)


class CommentLike(Base):
    __tablename__ = "comment_likes"

    comment_id = Column(String(48), primary_key=True)
    user_id = Column(String(32), primary_key=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class PostLike(Base):
    __tablename__ = "post_likes"

    post_id = Column(String(48), primary_key=True)
    user_id = Column(String(32), primary_key=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(48), primary_key=True)
    type = Column(String(16), nullable=False, default="system")
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    sort_order = Column(Integer, nullable=False, default=0, index=True)
    # 为空表示全员广播，否则仅指定用户可见
    target_user_id = Column(String(32), nullable=True, index=True)


class PostFavorite(Base):
    """帖子收藏：同一用户对同一帖子只会有一条记录。"""

    __tablename__ = "post_favorites"

    post_id = Column(String(48), primary_key=True)
    user_id = Column(String(32), primary_key=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class MessageRead(Base):
    """用户已读记录：同一消息对不同用户各自独立。"""

    __tablename__ = "message_reads"

    user_id = Column(String(32), primary_key=True)
    message_id = Column(String(48), primary_key=True)
    read_at = Column(DateTime, nullable=False, default=datetime.now)


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(String(48), primary_key=True)
    user_id = Column(String(32), nullable=True, index=True)
    user = Column(String(80), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(32), default="功能建议")
    status = Column(String(16), nullable=False, default="pending")
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    sort_order = Column(Integer, nullable=False, default=0, index=True)


class DetectHistory(Base):
    __tablename__ = "detect_history"

    id = Column(String(48), primary_key=True)
    user_id = Column(String(32), nullable=True, index=True)
    image = Column(String(255), nullable=False)
    disease = Column(String(64), nullable=False)
    confidence = Column(Float, nullable=False)
    severity = Column(String(32), default="")
    created_at = Column(DateTime, nullable=False, default=datetime.now, index=True)


# ================= 密码哈希 =================
PBKDF2_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    """生成 pbkdf2_sha256$迭代次数$盐$摘要 格式的密码哈希。"""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), expected)
    except (AttributeError, TypeError, ValueError):
        return False


# ================= 会话与初始化 =================
def get_db():
    """FastAPI 依赖：每个请求一个会话，结束后自动关闭。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _parse_date(value):
    return datetime.strptime(value, "%Y-%m-%d")


def _parse_datetime(value):
    return datetime.strptime(value, "%Y-%m-%d %H:%M")


def init_db():
    """建表；若 users 为空则写入一次种子数据（重启不会重复写入）。"""
    Base.metadata.create_all(engine)
    migrate_db()
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            return
        _seed(db)
        db.commit()


def migrate_db():
    """为已存在的旧表补齐 user_id 归属字段（幂等，可反复执行）。"""

    def has_column(table, column):
        return column in {c["name"] for c in inspect(engine).get_columns(table)}

    with engine.begin() as conn:
        if not has_column("posts", "user_id"):
            conn.execute(
                text(
                    "ALTER TABLE posts ADD COLUMN user_id VARCHAR(32) NULL, "
                    "ADD INDEX ix_posts_user_id (user_id)"
                )
            )
        if not has_column("post_comments", "user_id"):
            conn.execute(
                text(
                    "ALTER TABLE post_comments ADD COLUMN user_id VARCHAR(32) NULL, "
                    "ADD INDEX ix_post_comments_user_id (user_id)"
                )
            )
        if not has_column("detect_history", "user_id"):
            conn.execute(
                text(
                    "ALTER TABLE detect_history ADD COLUMN user_id VARCHAR(32) NULL, "
                    "ADD INDEX ix_detect_history_user_id (user_id)"
                )
            )
        if not has_column("post_likes", "user_id"):
            # 旧的点赞没有归属信息，无法区分用户，直接清空后改为 (post_id, user_id) 联合主键
            conn.execute(text("DELETE FROM post_likes"))
            conn.execute(text("ALTER TABLE post_likes DROP PRIMARY KEY"))
            conn.execute(
                text(
                    "ALTER TABLE post_likes ADD COLUMN user_id VARCHAR(32) NOT NULL FIRST, "
                    "ADD PRIMARY KEY (post_id, user_id)"
                )
            )
        if not has_column("posts", "status"):
            conn.execute(
                text(
                    "ALTER TABLE posts ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'approved', "
                    "ADD INDEX ix_posts_status (status)"
                )
            )
        if not has_column("feedback", "user_id"):
            conn.execute(
                text(
                    "ALTER TABLE feedback ADD COLUMN user_id VARCHAR(32) NULL, "
                    "ADD INDEX ix_feedback_user_id (user_id)"
                )
            )
        if not has_column("messages", "target_user_id"):
            conn.execute(
                text(
                    "ALTER TABLE messages ADD COLUMN target_user_id VARCHAR(32) NULL, "
                    "ADD INDEX ix_messages_target_user_id (target_user_id)"
                )
            )
        if not has_column("users", "avatar"):
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN avatar VARCHAR(255) NOT NULL DEFAULT ''"
                )
            )
        if not has_column("posts", "attachments"):
            conn.execute(
                text("ALTER TABLE posts ADD COLUMN attachments JSON NULL")
            )
        if not has_column("posts", "readme"):
            conn.execute(
                text("ALTER TABLE posts ADD COLUMN readme TEXT NULL")
            )
        if not has_column("post_comments", "parent_id"):
            conn.execute(
                text(
                    "ALTER TABLE post_comments ADD COLUMN parent_id VARCHAR(48) NULL, "
                    "ADD INDEX ix_post_comments_parent_id (parent_id)"
                )
            )
        if not has_column("post_comments", "likes"):
            conn.execute(
                text(
                    "ALTER TABLE post_comments ADD COLUMN likes INT NOT NULL DEFAULT 0"
                )
            )
        if not has_column("user_profiles", "watchlist"):
            conn.execute(
                text("ALTER TABLE user_profiles ADD COLUMN watchlist JSON NULL")
            )
        # 历史帖子/评论按作者姓名回填归属
        conn.execute(
            text(
                "UPDATE posts p JOIN users u ON p.author = u.name "
                "SET p.user_id = u.id WHERE p.user_id IS NULL"
            )
        )
        conn.execute(
            text(
                "UPDATE post_comments c JOIN users u ON c.author = u.name "
                "SET c.user_id = u.id WHERE c.user_id IS NULL"
            )
        )


def _seed(db):
    import seed_data

    password_hash = hash_password(seed_data.DEMO_PASSWORD)
    name_to_id = {item["name"]: item["id"] for item in seed_data.USERS}

    for item in seed_data.USERS:
        db.add(
            User(
                id=item["id"],
                email=item["email"],
                password_hash=password_hash,
                name=item["name"],
                role=item["role"],
                status=item["status"],
                created_at=_parse_date(item["createdAt"]),
                last_login=_parse_datetime(item["lastLogin"]),
            )
        )

    profile = seed_data.PROFILE
    db.add(
        UserProfile(
            email=profile["email"],
            name=profile["name"],
            phone=profile.get("phone", ""),
            farm_name=profile.get("farmName", ""),
            location=profile.get("location", ""),
            area=profile.get("area", 0),
            crops=profile.get("crops", []),
            notify=profile.get("notify", {}),
        )
    )

    for item in seed_data.POSTS:
        db.add(
            Post(
                id=item["id"],
                user_id=name_to_id.get(item["author"]),
                author=item["author"],
                author_role=item["authorRole"],
                avatar=item.get("avatar", ""),
                title=item["title"],
                content=item["content"],
                images=item.get("images", []),
                tags=item.get("tags", []),
                likes=item.get("likes", 0),
                comments_count=item.get("comments", 0),
                created_at=_parse_datetime(item["createdAt"]),
                source=item.get("source", "web"),
                status="approved",
            )
        )

    for post_id, comments in seed_data.POST_COMMENTS.items():
        for item in comments:
            db.add(
                PostComment(
                    id=item["id"],
                    post_id=post_id,
                    user_id=name_to_id.get(item["author"]),
                    author=item["author"],
                    avatar=item.get("avatar", ""),
                    content=item["content"],
                    created_at=_parse_datetime(item["createdAt"]),
                )
            )

    for order, item in enumerate(seed_data.MESSAGES, start=1):
        db.add(
            Message(
                id=item["id"],
                type=item["type"],
                title=item["title"],
                content=item["content"],
                is_read=item["isRead"],
                created_at=_parse_datetime(item["createdAt"]),
                sort_order=order,
            )
        )

    for order, item in enumerate(seed_data.FEEDBACK, start=1):
        db.add(
            Feedback(
                id=item["id"],
                user=item["user"],
                content=item["content"],
                category=item.get("category", "功能建议"),
                status=item["status"],
                created_at=_parse_datetime(item["createdAt"]),
                sort_order=order,
            )
        )
