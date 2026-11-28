# -*- coding: utf-8 -*-
"""东方财富行情拉取与进程内缓存。

行情列表按“自选代码组合”缓存 30 秒，日 K 线缓存 10 分钟，均使用互斥锁保护。
请求失败时抛出 MarketError，由路由层转换为 502，不影响服务进程。
"""
from __future__ import annotations

import threading
import time
from datetime import datetime

import requests

QUOTE_URL = "https://push2.eastmoney.com/api/qt/ulist.np/get"
KLINE_URL = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
KLINE_UT = "fa5fd1943c7b386f172d6893dbfba10b"
KLINE_REFERER = "https://quote.eastmoney.com/"

UA = {"User-Agent": "Mozilla/5.0"}
TIMEOUT = 5.0
QUOTE_TTL = 30
KLINE_TTL = 600
KLINE_LIMIT = 90
MAX_WATCHLIST = 20
QUOTE_FIELDS = "f2,f3,f4,f5,f6,f8,f12,f14"

# 指数：中证农业取不到时自动跳过，仅保留前三个
INDICES = [
    {"secid": "1.000001", "code": "000001", "name": "上证指数"},
    {"secid": "0.399001", "code": "399001", "name": "深证成指"},
    {"secid": "0.399006", "code": "399006", "name": "创业板指"},
    {"secid": "1.000949", "code": "000949", "name": "中证农业"},
]

# 可选农业股票池（用户从中挑选自选）
POOL_LIST = [
    {"secid": "0.000998", "code": "000998", "name": "隆平高科"},
    {"secid": "0.002041", "code": "002041", "name": "登海种业"},
    {"secid": "0.300087", "code": "300087", "name": "荃银高科"},
    {"secid": "1.601952", "code": "601952", "name": "苏垦农发"},
    {"secid": "1.600598", "code": "600598", "name": "北大荒"},
    {"secid": "0.002714", "code": "002714", "name": "牧原股份"},
    {"secid": "0.300498", "code": "300498", "name": "温氏股份"},
    {"secid": "0.000876", "code": "000876", "name": "新希望"},
    {"secid": "0.002311", "code": "002311", "name": "海大集团"},
    {"secid": "1.600737", "code": "600737", "name": "中粮糖业"},
    {"secid": "0.000911", "code": "000911", "name": "南宁糖业"},
    {"secid": "0.002385", "code": "002385", "name": "大北农"},
    {"secid": "0.300189", "code": "300189", "name": "神农科技"},
    {"secid": "0.000895", "code": "000895", "name": "双汇发展"},
    {"secid": "0.000930", "code": "000930", "name": "中粮科技"},
    {"secid": "1.600127", "code": "600127", "name": "金健米业"},
    {"secid": "1.600354", "code": "600354", "name": "敦煌种业"},
    {"secid": "0.000860", "code": "000860", "name": "顺鑫农业"},
    {"secid": "0.002458", "code": "002458", "name": "益生股份"},
    {"secid": "0.002299", "code": "002299", "name": "圣农发展"},
    {"secid": "0.002124", "code": "002124", "name": "天邦食品"},
    {"secid": "0.002567", "code": "002567", "name": "唐人神"},
    {"secid": "1.603363", "code": "603363", "name": "傲农生物"},
    {"secid": "0.300761", "code": "300761", "name": "立华股份"},
    {"secid": "0.000048", "code": "000048", "name": "京基智农"},
    {"secid": "0.000713", "code": "000713", "name": "丰乐种业"},
    {"secid": "1.600371", "code": "600371", "name": "万向德农"},
    {"secid": "1.600540", "code": "600540", "name": "新赛股份"},
    {"secid": "0.000798", "code": "000798", "name": "中水渔业"},
    {"secid": "0.300094", "code": "300094", "name": "国联水产"},
    {"secid": "1.600467", "code": "600467", "name": "好当家"},
    {"secid": "0.002069", "code": "002069", "name": "獐子岛"},
    {"secid": "1.600298", "code": "600298", "name": "安琪酵母"},
    {"secid": "1.600873", "code": "600873", "name": "梅花生物"},
    {"secid": "0.300999", "code": "300999", "name": "金龙鱼"},
    {"secid": "1.600313", "code": "600313", "name": "农发种业"},
    {"secid": "1.605296", "code": "605296", "name": "神农集团"},
]

POOL = {item["code"]: item for item in POOL_LIST}
KLINE_CODES = POOL

DEFAULT_WATCHLIST = [
    "000998",
    "002041",
    "300087",
    "601952",
    "600598",
    "002714",
    "300498",
    "000876",
    "002311",
    "600737",
    "000911",
    "002385",
    "300189",
]


class MarketError(RuntimeError):
    """行情接口不可用时抛出。"""


_lock = threading.Lock()
_quote_cache = {}
_kline_cache = {}


def _get_json(url, params, headers=None):
    merged = dict(UA)
    if headers:
        merged.update(headers)
    try:
        response = requests.get(url, params=params, headers=merged, timeout=TIMEOUT)
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise MarketError("东方财富接口请求失败") from exc
    if not isinstance(payload, dict):
        raise MarketError("东方财富接口返回格式异常")
    return payload


def _num(value):
    """把接口里的数值（可能为 "-"）转换为 float，缺失时返回 None。"""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text or text == "-":
            return None
        try:
            return float(text)
        except ValueError:
            return None
    return None


def _parse_quote(meta, row):
    return {
        "code": meta["code"],
        "name": str(row.get("f14") or meta["name"]),
        "price": _num(row.get("f2")),
        "pct": _num(row.get("f3")),
        "change": _num(row.get("f4")),
        "amount": _num(row.get("f6")),
        "turnover": _num(row.get("f8")),
    }


def _fetch_quotes(secids):
    params = {
        "fltt": 2,
        "secids": ",".join(secids),
        "fields": QUOTE_FIELDS,
    }
    payload = _get_json(QUOTE_URL, params)
    rows = (payload.get("data") or {}).get("diff") or []
    return rows if isinstance(rows, list) else []


def get_pool():
    """返回全部可选农业股。"""
    return [{"code": item["code"], "name": item["name"]} for item in POOL_LIST]


def normalize_codes(codes):
    """去重并按股票池过滤；为空时返回默认自选。"""
    result = []
    for code in codes or []:
        code = str(code or "").strip()
        if code in POOL and code not in result:
            result.append(code)
    return result or list(DEFAULT_WATCHLIST)


def get_overview(codes=None):
    """返回指数与指定自选股的实时行情（30 秒缓存）。"""
    selected = normalize_codes(codes)
    key = tuple(selected)
    now = time.time()
    with _lock:
        cached = _quote_cache.get(key)
        if cached is not None and now - cached["at"] < QUOTE_TTL:
            return cached["data"]

        metas = [POOL[code] for code in selected]
        rows = _fetch_quotes([item["secid"] for item in INDICES + metas])
        by_code = {}
        for row in rows:
            code = str(row.get("f12") or "")
            if code:
                by_code[code] = row

        indices = [
            _parse_quote(item, by_code[item["code"]])
            for item in INDICES
            if item["code"] in by_code
        ]
        stocks = [
            _parse_quote(item, by_code[item["code"]])
            for item in metas
            if item["code"] in by_code
        ]
        if not indices and not stocks:
            raise MarketError("行情数据为空")

        result = {
            "source": "eastmoney",
            "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "codes": selected,
            "indices": indices,
            "stocks": stocks,
        }
        if len(_quote_cache) > 50:
            _quote_cache.clear()
        _quote_cache[key] = {"at": now, "data": result}
        return result


def get_kline(code):
    """返回指定农业股最近 90 根日 K（10 分钟缓存）。"""
    code = str(code or "").strip()
    meta = KLINE_CODES.get(code)
    if meta is None:
        raise MarketError("不支持的股票代码")

    now = time.time()
    with _lock:
        cached = _kline_cache.get(code)
        if cached is not None and now - cached["at"] < KLINE_TTL:
            return cached["data"]

        params = {
            "secid": meta["secid"],
            "ut": KLINE_UT,
            "fields1": "f1,f2,f3,f4,f5,f6",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58",
            "klt": 101,
            "fqt": 1,
            "beg": "20250101",
            "end": "20500101",
        }
        payload = _get_json(KLINE_URL, params, headers={"Referer": KLINE_REFERER})
        data = payload.get("data") or {}
        lines = data.get("klines") or []
        klines = []
        for line in lines[-KLINE_LIMIT:]:
            parts = str(line).split(",")
            if len(parts) < 7:
                continue
            volume = _num(parts[5])
            klines.append(
                {
                    "date": parts[0],
                    "open": _num(parts[1]),
                    "close": _num(parts[2]),
                    "high": _num(parts[3]),
                    "low": _num(parts[4]),
                    "volume": int(volume) if volume is not None else 0,
                    "amount": _num(parts[6]),
                }
            )
        if not klines:
            raise MarketError("K 线数据为空")

        result = {
            "source": "eastmoney",
            "code": code,
            "name": str(data.get("name") or meta["name"]),
            "klines": klines,
        }
        _kline_cache[code] = {"at": now, "data": result}
        return result
