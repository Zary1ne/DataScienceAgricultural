# -*- coding: utf-8 -*-
"""ONNX inference for the rice disease classifier."""
import io
import json
import os
import threading
import time

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")
ONNX_PATH = os.path.join(MODEL_DIR, "rice_disease.onnx")
LABELS_PATH = os.path.join(MODEL_DIR, "labels.json")
MODEL_VERSION = "rice-9cls-efficientnetb0-v5"

# v5 模型输入为 256×256（旧版为 224×224），短边先缩放至 292 再中心裁剪
IMG_SIZE = 256
RESIZE_SHORT_EDGE = 292
MAX_IMAGE_PIXELS = 25_000_000
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}

_session = None
_labels = None
_input_name = None
_output_name = None
_load_error = None
_load_lock = threading.Lock()


class ModelUnavailableError(RuntimeError):
    pass


class InvalidImageError(ValueError):
    pass


def available():
    return os.path.isfile(ONNX_PATH) and os.path.isfile(LABELS_PATH)


def _validate_shape(shape, expected, tensor_name):
    if len(shape) != len(expected):
        raise ModelUnavailableError(
            f"模型 {tensor_name} 张量维度不匹配，预期 {len(expected)} 维"
        )
    for actual, required in zip(shape, expected):
        if isinstance(actual, int) and actual != required:
            raise ModelUnavailableError(
                f"模型 {tensor_name} 张量形状不匹配，预期 {expected}，实际 {shape}"
            )


def load_model():
    global _session, _labels, _input_name, _output_name, _load_error
    if _session is not None:
        return _session
    if _load_error is not None:
        raise ModelUnavailableError(_load_error)

    with _load_lock:
        if _session is not None:
            return _session
        if _load_error is not None:
            raise ModelUnavailableError(_load_error)
        if not available():
            _load_error = "未找到 rice_disease.onnx 或 labels.json"
            raise ModelUnavailableError(_load_error)

        try:
            import onnxruntime as ort
        except ImportError as exc:
            _load_error = "缺少 onnxruntime，请按 requirements.txt 安装后重启后端"
            raise ModelUnavailableError(_load_error) from exc

        try:
            with open(LABELS_PATH, encoding="utf-8") as label_file:
                labels = json.load(label_file)
        except (OSError, json.JSONDecodeError) as exc:
            _load_error = f"读取模型标签失败：{exc}"
            raise ModelUnavailableError(_load_error) from exc

        if not isinstance(labels, dict) or not labels:
            _load_error = "labels.json 必须是非空的类别序号映射"
            raise ModelUnavailableError(_load_error)
        expected_keys = [str(index) for index in range(len(labels))]
        if any(key not in labels or not isinstance(labels[key], str) for key in expected_keys):
            _load_error = "labels.json 类别序号必须从 0 连续排列，且对应值必须是文本"
            raise ModelUnavailableError(_load_error)

        try:
            session = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
        except Exception as exc:
            _load_error = f"加载 ONNX 模型失败：{exc}"
            raise ModelUnavailableError(_load_error) from exc

        inputs = session.get_inputs()
        outputs = session.get_outputs()
        if len(inputs) != 1 or len(outputs) != 1:
            _load_error = "模型必须包含一个输入张量和一个输出张量"
            raise ModelUnavailableError(_load_error)

        _validate_shape(inputs[0].shape, [1, 3, IMG_SIZE, IMG_SIZE], "输入")
        _validate_shape(outputs[0].shape, [1, len(labels)], "输出")
        _labels = labels
        _input_name = inputs[0].name
        _output_name = outputs[0].name
        _session = session
        return _session


def model_info():
    load_model()
    return {"version": MODEL_VERSION, "classes": len(_labels)}


def preprocess(image):
    image = image.convert("RGB")
    width, height = image.size
    scale = RESIZE_SHORT_EDGE / min(width, height)
    image = image.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.Resampling.BILINEAR,
    )
    width, height = image.size
    left = (width - IMG_SIZE) // 2
    top = (height - IMG_SIZE) // 2
    image = image.crop((left, top, left + IMG_SIZE, top + IMG_SIZE))
    array = np.asarray(image, dtype=np.float32) / 255.0
    array = (array - MEAN) / STD
    return np.transpose(array, (2, 0, 1))[None].astype(np.float32)


def _decode_image(image_bytes):
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            if image.format not in SUPPORTED_FORMATS:
                raise InvalidImageError("仅支持 JPG、PNG 或 WebP 图片")
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise InvalidImageError("图片尺寸过大")
            image.load()
            # 手机竖拍图按 EXIF 方向转正，否则模型拿到的是旋转 90° 的图像
            return ImageOps.exif_transpose(image).convert("RGB")
    except InvalidImageError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("图片无法读取或文件已损坏") from exc


def predict(image_bytes, topk=3):
    """Return top-k class predictions and inference duration in milliseconds."""
    session = load_model()
    image = _decode_image(image_bytes)
    input_tensor = preprocess(image)

    started_at = time.perf_counter()
    output = session.run([_output_name], {_input_name: input_tensor})[0]
    elapsed_ms = round((time.perf_counter() - started_at) * 1000, 1)

    logits = np.asarray(output, dtype=np.float32)
    if logits.shape != (1, len(_labels)) or not np.isfinite(logits).all():
        raise ModelUnavailableError("模型输出无效或类别数量与标签文件不一致")

    logits = logits[0] - logits[0].max()
    probabilities = np.exp(logits)
    probabilities /= probabilities.sum()
    order = np.argsort(-probabilities)[:max(1, min(topk, len(_labels)))]
    results = [
        {
            "label": _labels[str(int(index))],
            "confidence": float(probabilities[index]),
        }
        for index in order
    ]
    return results, elapsed_ms
