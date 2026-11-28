# -*- coding: utf-8 -*-
"""数据访问层：把 MySQL 记录转换为前端原有的 JSON 结构。"""
import secrets
import time
from datetime import date, datetime, time as dtime, timedelta

from sqlalchemy import delete, func, or_, select

from db import (
    AuthSession,
    CommentLike,
    DetectHistory,
    Feedback,
    Message,
    MessageRead,
    Post,
    PostComment,
    PostFavorite,
    PostLike,
    User,
    UserProfile,
    hash_password,
    verify_password,
)

DATETIME_FMT = "%Y-%m-%d %H:%M"
DATE_FMT = "%Y-%m-%d"


def _fmt_dt(value):
    return value.strftime(DATETIME_FMT) if value else ""


def _fmt_date(value):
    return value.strftime(DATE_FMT) if value else ""


# ================= 序列化 =================
def _user_dict(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "avatar": user.avatar or "",
        "createdAt": _fmt_date(user.created_at),
        "lastLogin": _fmt_dt(user.last_login),
    }


def _avatar_map(db, user_ids):
    """批量查询用户头像，避免列表接口逐条查库。"""
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    rows = db.execute(select(User.id, User.avatar).where(User.id.in_(ids))).all()
    return {uid: avatar or "" for uid, avatar in rows}


def _post_dict(post, liked=False, favorited=False, author_avatar=""):
    return {
        "id": post.id,
        "userId": post.user_id or "",
        "author": post.author,
        "authorRole": post.author_role,
        "authorAvatar": author_avatar or "",
        "avatar": post.avatar,
        "title": post.title,
        "content": post.content,
        "images": post.images or [],
        "tags": post.tags or [],
        "likes": post.likes,
        "liked": bool(liked),
        "favorited": bool(favorited),
        "comments": post.comments_count,
        "createdAt": _fmt_dt(post.created_at),
        "source": post.source,
        "status": post.status,
        "attachments": post.attachments or [],
        "readme": post.readme or "",
    }


def _comment_dict(comment, liked=False, avatar_url=""):
    return {
        "id": comment.id,
        "userId": comment.user_id or "",
        "author": comment.author,
        "avatar": comment.avatar,
        "avatarUrl": avatar_url or "",
        "content": comment.content,
        "createdAt": _fmt_dt(comment.created_at),
        "parentId": comment.parent_id or "",
        "likes": comment.likes or 0,
        "liked": bool(liked),
    }


def _message_dict(message, is_read=False):
    return {
        "id": message.id,
        "type": message.type,
        "title": message.title,
        "content": message.content,
        "isRead": bool(is_read),
        "createdAt": _fmt_dt(message.created_at),
    }


def _feedback_dict(item):
    return {
        "id": item.id,
        "user": item.user,
        "content": item.content,
        "category": item.category,
        "status": item.status,
        "createdAt": _fmt_dt(item.created_at),
    }


def _detect_dict(item):
    return {
        "id": item.id,
        "image": item.image,
        "disease": item.disease,
        "confidence": item.confidence,
        "severity": item.severity,
        "time": _fmt_dt(item.created_at),
    }


def _profile_dict(profile):
    return {
        "name": profile.name,
        "email": profile.email,
        "phone": profile.phone,
        "farmName": profile.farm_name,
        "location": profile.location,
        "area": profile.area,
        "crops": profile.crops or [],
        "notify": profile.notify or {},
        "watchlist": profile.watchlist or [],
    }


# ================= 用户与资料 =================
def authenticate(db, email, password):
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.password_hash):
        return None
    if user.status != "active":
        return None
    user.last_login = datetime.now()
    db.commit()
    db.refresh(user)
    return user


def register_user(db, email, password, name=None):
    """注册新用户；邮箱已存在时返回 None。"""
    email = (email or "").strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        return None
    user = User(
        id=f"u{int(time.time() * 1000)}",
        email=email,
        password_hash=hash_password(password),
        name=(name or email.split("@")[0])[:80],
        role="user",
        status="active",
        created_at=datetime.now(),
        last_login=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _ensure_profile(db, email, user.name)
    return user


SESSION_TTL_DAYS = 7


def create_session(db, user_id, ttl_days=SESSION_TTL_DAYS):
    """签发随机会话 token 并写入 sessions 表。"""
    token = secrets.token_urlsafe(32)
    now = datetime.now()
    db.add(
        AuthSession(
            token=token,
            user_id=user_id,
            created_at=now,
            expires_at=now + timedelta(days=ttl_days),
        )
    )
    db.commit()
    return token


def get_user_by_token(db, token):
    """按 X-Token 查出用户；token 不存在或已过期返回 None。"""
    if not token:
        return None
    session = db.get(AuthSession, token)
    if session is None:
        return None
    if session.expires_at < datetime.now():
        db.delete(session)
        db.commit()
        return None
    return db.get(User, session.user_id)


def delete_session(db, token):
    session = db.get(AuthSession, token) if token else None
    if session is None:
        return False
    db.delete(session)
    db.commit()
    return True


def delete_user_sessions(db, user_id, keep_token=None):
    """删除某用户的全部会话；keep_token 用于保留当前设备。"""
    stmt = delete(AuthSession).where(AuthSession.user_id == user_id)
    if keep_token:
        stmt = stmt.where(AuthSession.token != keep_token)
    db.execute(stmt)
    db.commit()


def change_password(db, user, old_password, new_password):
    """校验原密码后更新为新密码；原密码错误返回 False。"""
    if not verify_password(old_password, user.password_hash):
        return False
    user.password_hash = hash_password(new_password)
    db.commit()
    return True


def count_users(db):
    return db.scalar(select(func.count()).select_from(User)) or 0


def list_users(db):
    users = db.scalars(select(User).order_by(User.id)).all()
    # 每个用户的发帖数量，方便管理端观察活跃度
    counts = dict(
        db.execute(select(Post.user_id, func.count()).group_by(Post.user_id)).all()
    )
    result = []
    for user in users:
        data = _user_dict(user)
        data["postCount"] = counts.get(user.id, 0)
        result.append(data)
    return result


def get_user(db, user_id):
    return db.get(User, user_id)


def update_user(db, user_id, role=None, status=None):
    """管理员修改用户角色/状态；禁用后立即注销该用户全部会话。"""
    user = db.get(User, user_id)
    if user is None:
        return None
    if role in ("admin", "user"):
        user.role = role
    if status in ("active", "disabled"):
        user.status = status
    db.commit()
    if user.status == "disabled":
        delete_user_sessions(db, user.id)
    return _user_dict(user)


def reset_user_password(db, user_id, new_password):
    user = db.get(User, user_id)
    if user is None:
        return False
    user.password_hash = hash_password(new_password)
    db.commit()
    delete_user_sessions(db, user_id)
    return True


def set_user_avatar(db, user_id, avatar_url):
    """更新用户头像，返回旧地址供调用方清理文件。"""
    user = db.get(User, user_id)
    if user is None:
        return None
    previous = user.avatar or ""
    user.avatar = avatar_url or ""
    db.commit()
    return {"avatarUrl": user.avatar, "previous": previous}


def _ensure_profile(db, email, name=None):
    """按邮箱取资料，不存在时自动创建（每个用户一份独立资料）。"""
    profile = db.get(UserProfile, email)
    if profile is None:
        profile = UserProfile(
            email=email,
            name=(name or email.split("@")[0])[:80],
            phone="",
            farm_name="",
            location="",
            area=0,
            crops=[],
            notify={"alert": True, "daily": True, "community": False},
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def get_profile(db, email):
    return _profile_dict(_ensure_profile(db, email))


def update_profile(db, email, patch):
    profile = _ensure_profile(db, email)
    mapping = {
        "name": "name",
        "phone": "phone",
        "farmName": "farm_name",
        "location": "location",
        "area": "area",
        "crops": "crops",
        "notify": "notify",
    }
    for key, column in mapping.items():
        if key in patch:
            setattr(profile, column, patch[key])
    if "name" in patch:
        user = db.scalar(select(User).where(User.email == email))
        if user is not None:
            user.name = patch["name"]
    db.commit()
    db.refresh(profile)
    return _profile_dict(profile)


def get_watchlist(db, email):
    """返回用户自选股票代码；尚未设置时返回空列表。"""
    profile = _ensure_profile(db, email)
    return list(profile.watchlist or [])


def set_watchlist(db, email, codes):
    profile = _ensure_profile(db, email)
    profile.watchlist = list(codes)
    db.commit()
    return list(profile.watchlist)


# ================= 社区 =================
def list_posts(db, user_id=None):
    query = select(Post)
    if user_id:
        # 公共社区只展示审核通过的帖子；本人可以看到自己待审核的帖子
        query = query.where(or_(Post.status == "approved", Post.user_id == user_id))
    else:
        query = query.where(Post.status == "approved")
    posts = db.scalars(
        query.order_by(Post.created_at.desc(), Post.id.desc())
    ).all()
    liked_ids = set()
    favorited_ids = set()
    if user_id:
        liked_ids = set(
            db.scalars(select(PostLike.post_id).where(PostLike.user_id == user_id)).all()
        )
        favorited_ids = set(
            db.scalars(
                select(PostFavorite.post_id).where(PostFavorite.user_id == user_id)
            ).all()
        )
    avatars = _avatar_map(db, [post.user_id for post in posts])
    return [
        _post_dict(
            post,
            post.id in liked_ids,
            post.id in favorited_ids,
            avatars.get(post.user_id, ""),
        )
        for post in posts
    ]


def get_post_detail(db, post_id, user_id=None):
    post = db.get(Post, post_id)
    if post is None:
        return None
    liked = favorited = False
    if user_id:
        liked = db.get(PostLike, (post_id, user_id)) is not None
        favorited = db.get(PostFavorite, (post_id, user_id)) is not None
    avatar = db.get(User, post.user_id).avatar if post.user_id else ""
    return _post_dict(post, liked, favorited, avatar or "")


def new_post_id(db):
    total = db.scalar(select(func.count()).select_from(Post)) or 0
    return f"c{total + 1}-{int(time.time())}"


def get_post(db, post_id):
    return db.get(Post, post_id)


def update_post(db, post, title=None, content=None, tags=None):
    """更新自己的帖子；内容变化后需重新审核。"""
    if title is not None:
        post.title = title
    if content is not None:
        post.content = content
    if tags is not None:
        post.tags = list(tags)
    post.status = "pending"
    db.commit()
    db.refresh(post)
    avatar = db.get(User, post.user_id).avatar if post.user_id else ""
    return _post_dict(post, author_avatar=avatar or "")


def delete_post(db, post):
    """删除帖子并级联清理评论、评论点赞、帖子点赞与收藏。"""
    comment_ids = db.scalars(
        select(PostComment.id).where(PostComment.post_id == post.id)
    ).all()
    if comment_ids:
        db.execute(delete(CommentLike).where(CommentLike.comment_id.in_(comment_ids)))
    db.execute(delete(PostComment).where(PostComment.post_id == post.id))
    db.execute(delete(PostLike).where(PostLike.post_id == post.id))
    db.execute(delete(PostFavorite).where(PostFavorite.post_id == post.id))
    db.delete(post)
    db.commit()
    return True


def add_favorite(db, post_id, user_id):
    if db.get(Post, post_id) is None:
        return None
    if db.get(PostFavorite, (post_id, user_id)) is None:
        db.add(PostFavorite(post_id=post_id, user_id=user_id, created_at=datetime.now()))
        db.commit()
    return {"ok": True, "favorited": True}


def remove_favorite(db, post_id, user_id):
    if db.get(Post, post_id) is None:
        return None
    favorite = db.get(PostFavorite, (post_id, user_id))
    if favorite is not None:
        db.delete(favorite)
        db.commit()
    return {"ok": True, "favorited": False}


def create_post(
    db,
    title,
    content,
    tags,
    author=None,
    user_id=None,
    role="user",
    post_id=None,
    attachments=None,
    readme=None,
):
    if not author:
        profile = db.scalars(select(UserProfile).order_by(UserProfile.email)).first()
        author = profile.name if profile else "农户"
    avatar = db.get(User, user_id).avatar if user_id else ""
    post = Post(
        id=post_id or new_post_id(db),
        user_id=user_id,
        author=author,
        author_role=role,
        avatar=author[:1],
        title=title,
        content=content,
        images=[],
        tags=list(tags or []),
        likes=0,
        comments_count=0,
        created_at=datetime.now(),
        source="web",
        status="pending",
        attachments=list(attachments or []),
        readme=readme or "",
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_dict(post, author_avatar=avatar or "")


def toggle_like(db, post_id, user_id):
    post = db.get(Post, post_id)
    if post is None:
        return None
    liked = db.get(PostLike, (post_id, user_id))
    if liked is None:
        db.add(PostLike(post_id=post_id, user_id=user_id, created_at=datetime.now()))
        post.likes += 1
        liked_now = True
    else:
        db.delete(liked)
        post.likes = max(0, post.likes - 1)
        liked_now = False
    db.commit()
    return {"ok": True, "likes": post.likes, "liked": liked_now}


def list_comments(db, post_id, user_id=None):
    comments = db.scalars(
        select(PostComment)
        .where(PostComment.post_id == post_id)
        .order_by(PostComment.created_at.asc(), PostComment.id.asc())
    ).all()
    liked_ids = set()
    if user_id and comments:
        liked_ids = set(
            db.scalars(
                select(CommentLike.comment_id).where(
                    CommentLike.user_id == user_id,
                    CommentLike.comment_id.in_([c.id for c in comments]),
                )
            ).all()
        )
    avatars = _avatar_map(db, [comment.user_id for comment in comments])
    return [
        _comment_dict(comment, comment.id in liked_ids, avatars.get(comment.user_id, ""))
        for comment in comments
    ]


def add_comment(db, post_id, content, author=None, user_id=None, parent_id=None):
    post = db.get(Post, post_id)
    if post is None:
        return None
    parent = None
    if parent_id:
        parent = db.get(PostComment, parent_id)
        if parent is None or parent.post_id != post_id:
            return None
    if not author:
        profile = db.scalars(select(UserProfile).order_by(UserProfile.email)).first()
        author = profile.name if profile else "农户"
    avatar = db.get(User, user_id).avatar if user_id else ""
    comment = PostComment(
        id=f"cm{int(time.time() * 1000)}",
        post_id=post_id,
        user_id=user_id,
        author=author,
        avatar=author[:1],
        content=content,
        created_at=datetime.now(),
        parent_id=parent_id or None,
        likes=0,
    )
    db.add(comment)
    post.comments_count += 1
    db.commit()
    db.refresh(comment)
    db.refresh(post)
    return {
        "ok": True,
        "comment": _comment_dict(comment, False, avatar or ""),
        "comments": post.comments_count,
    }


def toggle_comment_like(db, comment_id, user_id):
    comment = db.get(PostComment, comment_id)
    if comment is None:
        return None
    row = db.get(CommentLike, (comment_id, user_id))
    if row is None:
        db.add(
            CommentLike(
                comment_id=comment_id, user_id=user_id, created_at=datetime.now()
            )
        )
        comment.likes = (comment.likes or 0) + 1
        liked_now = True
    else:
        db.delete(row)
        comment.likes = max(0, (comment.likes or 0) - 1)
        liked_now = False
    db.commit()
    return {"ok": True, "likes": comment.likes, "liked": liked_now}


def get_comment(db, comment_id):
    return db.get(PostComment, comment_id)


def delete_comment(db, comment):
    """删除评论及其直接回复，并同步评论数与点赞记录。"""
    replies = db.scalars(
        select(PostComment).where(PostComment.parent_id == comment.id)
    ).all()
    ids = [comment.id] + [reply.id for reply in replies]
    db.execute(delete(CommentLike).where(CommentLike.comment_id.in_(ids)))
    db.execute(delete(PostComment).where(PostComment.id.in_(ids)))
    post = db.get(Post, comment.post_id)
    if post is not None:
        post.comments_count = max(0, post.comments_count - len(ids))
    db.commit()
    return True


# ================= 病害识别历史 =================
def add_detect_record(db, filename, disease, confidence, severity, user_id=None):
    today_count = count_today_detections(db)
    record = DetectHistory(
        id=f"h{int(time.time() * 1000)}",
        user_id=user_id,
        image=filename or f"image-{today_count + 1}.jpg",
        disease=disease,
        confidence=confidence,
        severity=severity,
        created_at=datetime.now(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    owner = DetectHistory.user_id == user_id if user_id else DetectHistory.user_id.is_(None)
    total = db.scalar(select(func.count()).select_from(DetectHistory).where(owner)) or 0
    if total > 100:
        keep_ids = db.scalars(
            select(DetectHistory.id)
            .where(owner)
            .order_by(DetectHistory.created_at.desc(), DetectHistory.id.desc())
            .limit(100)
        ).all()
        db.execute(delete(DetectHistory).where(owner, DetectHistory.id.not_in(keep_ids)))
        db.commit()
    return _detect_dict(record)


def list_detect_history(db, user_id=None):
    query = select(DetectHistory)
    if user_id:
        query = query.where(DetectHistory.user_id == user_id)
    else:
        query = query.where(DetectHistory.user_id.is_(None))
    records = db.scalars(
        query.order_by(DetectHistory.created_at.desc(), DetectHistory.id.desc())
    ).all()
    return [_detect_dict(record) for record in records]


def delete_detect_record(db, record_id, user_id):
    record = db.get(DetectHistory, record_id)
    if record is None or record.user_id != user_id:
        return False
    db.delete(record)
    db.commit()
    return True


def clear_detect_history(db, user_id):
    db.execute(delete(DetectHistory).where(DetectHistory.user_id == user_id))
    db.commit()


def count_today_detections(db):
    start = datetime.combine(date.today(), dtime.min)
    return db.scalar(
        select(func.count())
        .select_from(DetectHistory)
        .where(DetectHistory.created_at >= start)
    ) or 0


# ================= 消息中心 =================
def _user_read_ids(db, user_id):
    return set(
        db.scalars(select(MessageRead.message_id).where(MessageRead.user_id == user_id)).all()
    )


def _visible_messages(user_id):
    """全员广播 + 当前用户的定向消息；未登录时只返回广播。"""
    if not user_id:
        return Message.target_user_id.is_(None)
    return or_(Message.target_user_id.is_(None), Message.target_user_id == user_id)


def list_messages(db, user_id):
    messages = db.scalars(
        select(Message)
        .where(_visible_messages(user_id))
        .order_by(Message.sort_order.asc(), Message.id.asc())
    ).all()
    read_ids = _user_read_ids(db, user_id)
    # is_read 为种子数据的默认已读状态，用户实际已读记录在 message_reads
    return [
        _message_dict(message, message.is_read or message.id in read_ids)
        for message in messages
    ]


def mark_all_read(db, user_id):
    read_ids = _user_read_ids(db, user_id)
    message_ids = db.scalars(select(Message.id).where(_visible_messages(user_id))).all()
    for message_id in message_ids:
        if message_id not in read_ids:
            db.add(MessageRead(user_id=user_id, message_id=message_id, read_at=datetime.now()))
    db.commit()


def mark_read(db, message_id, user_id):
    if db.get(Message, message_id) is None:
        return
    if db.get(MessageRead, (user_id, message_id)) is None:
        db.add(MessageRead(user_id=user_id, message_id=message_id, read_at=datetime.now()))
        db.commit()


def add_message(db, title, content, target_user_id=None):
    total = db.scalar(select(func.count()).select_from(Message)) or 0
    min_order = db.scalar(select(func.min(Message.sort_order)))
    message = Message(
        id=f"m{total + 1}-{int(time.time())}",
        type="admin",
        title=title,
        content=content,
        is_read=False,
        created_at=datetime.now(),
        sort_order=(min_order if min_order is not None else 0) - 1,
        target_user_id=target_user_id or None,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _message_dict(message)


def count_unread_messages(db, user_id=None):
    unread = select(func.count()).select_from(Message).where(Message.is_read.is_(False))
    if user_id:
        read_ids = select(MessageRead.message_id).where(MessageRead.user_id == user_id)
        unread = unread.where(_visible_messages(user_id), Message.id.not_in(read_ids))
    else:
        unread = unread.where(Message.target_user_id.is_(None))
    return db.scalar(unread) or 0


# ================= 管理端 =================
def list_feedback(db):
    items = db.scalars(
        select(Feedback).order_by(Feedback.sort_order.asc(), Feedback.id.asc())
    ).all()
    return [_feedback_dict(item) for item in items]


def handle_feedback(db, feedback_id):
    item = db.get(Feedback, feedback_id)
    if item is None:
        return False
    item.status = "handled"
    db.commit()
    return True


def add_feedback(db, user, category, content):
    min_order = db.scalar(select(func.min(Feedback.sort_order)))
    item = Feedback(
        id=f"f{int(time.time() * 1000)}",
        user_id=user.id,
        user=user.name,
        content=content,
        category=category or "功能建议",
        status="pending",
        created_at=datetime.now(),
        sort_order=(min_order if min_order is not None else 0) - 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _feedback_dict(item)


def list_user_feedback(db, user_id):
    items = db.scalars(
        select(Feedback)
        .where(Feedback.user_id == user_id)
        .order_by(Feedback.created_at.desc(), Feedback.id.desc())
    ).all()
    return [_feedback_dict(item) for item in items]


def list_pending_posts(db):
    posts = db.scalars(
        select(Post)
        .where(Post.status == "pending")
        .order_by(Post.created_at.desc(), Post.id.desc())
    ).all()
    return [_post_dict(post) for post in posts]


def approve_post(db, post_id):
    post = db.get(Post, post_id)
    if post is None:
        return False
    post.status = "approved"
    db.commit()
    return True


def count_posts(db):
    return db.scalar(select(func.count()).select_from(Post)) or 0


def count_pending_feedback(db):
    return db.scalar(
        select(func.count()).select_from(Feedback).where(Feedback.status == "pending")
    ) or 0
