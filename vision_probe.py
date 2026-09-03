#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片识别探针：把本地图片发给 /api/vision（GLM-4V-Flash），打印模型描述。

用法：
  python vision_probe.py <图片路径> [提示词]
"""
import base64
import json
import os
import sys
import urllib.request

MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
}

DEFAULT_PROMPT = (
    '请极其详细地描述这张图片里的 UI / 按钮 / 侧边栏设计：'
    '颜色、形状、边框、高亮、字体风格、每个按键的位置与样式、'
    '以及整体的视觉风格，方便我照着复刻成网页侧边栏。'
)


def main():
    if len(sys.argv) < 2:
        print('用法：python vision_probe.py <图片路径> [提示词]')
        sys.exit(1)
    path = sys.argv[1]
    if not os.path.isfile(path):
        print('文件不存在：', path)
        sys.exit(1)
    prompt = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PROMPT

    ext = os.path.splitext(path)[1].lower()
    mime = MIME.get(ext, 'image/png')
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    data_uri = 'data:%s;base64,%s' % (mime, b64)

    body = json.dumps({'image': data_uri, 'prompt': prompt}).encode('utf-8')
    req = urllib.request.Request(
        'http://localhost:8000/api/vision',
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=200) as resp:
            result = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print('请求失败：', e)
        sys.exit(1)

    if 'reply' in result:
        print(result['reply'])
    else:
        print('后端返回：', result)
        sys.exit(1)


if __name__ == '__main__':
    main()
