#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TAKE YOUR ☾ TIME — AI 助手后端
================================
用标准库 http.server 提供静态页面 + /api/chat 代理大模型接口。
API Key 只保存在本机 config.json（或环境变量），绝不暴露给前端。

用法：
  1. 在 config.json 填入 api_key
  2. python server.py
  3. 浏览器打开 http://localhost:8000  （不要用 file:// 打开，否则无法连后端）
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, unquote

import requests

# Windows 控制台常为 GBK，打印含 ☾ 等特殊字符会崩溃，这里容错处理
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, 'reconfigure'):
        try:
            _stream.reconfigure(errors='replace')
        except Exception:
            pass

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(ROOT, 'config.json')
PROMPT_PATH = os.path.join(ROOT, 'assistant', 'system_prompt.md')
PORT = int(os.environ.get('PORT', '8000'))


def load_config():
    cfg = {
        'api_key': os.environ.get('DEEPSEEK_API_KEY', ''),
        'base_url': 'https://api.deepseek.com',
        'model': 'deepseek-chat',
        'temperature': 1.0,
        # 视觉模型（GLM-4V-Flash，智谱 bigmodel.cn）
        'vision_api_key': os.environ.get('VISION_API_KEY', ''),
        'vision_base_url': os.environ.get('VISION_BASE_URL', 'https://open.bigmodel.cn/api/paas/v4'),
        'vision_model': os.environ.get('VISION_MODEL', 'GLM-4V-Flash'),
    }
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                cfg.update(json.load(f))
        except Exception as e:
            print('[warn] 读取 config.json 失败：', e)
    cfg['api_key'] = cfg.get('api_key') or os.environ.get('DEEPSEEK_API_KEY', '')
    cfg['vision_api_key'] = cfg.get('vision_api_key') or os.environ.get('VISION_API_KEY', '')
    cfg['vision_base_url'] = cfg.get('vision_base_url') or os.environ.get('VISION_BASE_URL', 'https://open.bigmodel.cn/api/paas/v4')
    cfg['vision_model'] = cfg.get('vision_model') or os.environ.get('VISION_MODEL', 'GLM-4V-Flash')
    return cfg


def load_prompt():
    if os.path.exists(PROMPT_PATH):
        with open(PROMPT_PATH, 'r', encoding='utf-8') as f:
            return f.read().strip()
    return ''


CFG = load_config()
SYSTEM_PROMPT = load_prompt()

MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.md': 'text/plain; charset=utf-8',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
}


def call_llm(messages):
    """调用 OpenAI 兼容的 chat/completions 接口（DeepSeek 默认）。"""
    if not CFG['api_key']:
        raise RuntimeError('缺少 API Key：请在 config.json 填入 api_key（或设置环境变量 DEEPSEEK_API_KEY）。')
    url = CFG['base_url'].rstrip('/') + '/chat/completions'
    headers = {
        'Authorization': 'Bearer ' + CFG['api_key'],
        'Content-Type': 'application/json',
    }
    payload = {
        'model': CFG['model'],
        'messages': messages,
        'temperature': CFG.get('temperature', 1.0),
        'stream': False,
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=180)
    if resp.status_code != 200:
        raise RuntimeError('大模型接口返回 %s：%s' % (resp.status_code, resp.text[:400]))
    data = resp.json()
    try:
        return data['choices'][0]['message']['content']
    except (KeyError, IndexError):
        raise RuntimeError('大模型返回结构异常：%s' % json.dumps(data, ensure_ascii=False)[:400])


def call_vision(prompt, image_data_uri):
    """调用 GLM-4V-Flash 视觉模型识别图片（OpenAI 兼容接口）。"""
    key = CFG.get('vision_api_key', '')
    if not key:
        raise RuntimeError('缺少 VISION_API_KEY：请在环境变量或 config.json 中配置。')
    url = CFG.get('vision_base_url', '').rstrip('/') + '/chat/completions'
    headers = {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
    }
    payload = {
        'model': CFG.get('vision_model', 'GLM-4V-Flash'),
        'messages': [
            {
                'role': 'user',
                'content': [
                    {'type': 'image_url', 'image_url': {'url': image_data_uri}},
                    {'type': 'text', 'text': prompt},
                ],
            }
        ],
        'temperature': 0.3,
        'stream': False,
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=180)
    if resp.status_code != 200:
        raise RuntimeError('视觉接口返回 %s：%s' % (resp.status_code, resp.text[:400]))
    data = resp.json()
    try:
        return data['choices'][0]['message']['content']
    except (KeyError, IndexError):
        raise RuntimeError('视觉接口返回结构异常：%s' % json.dumps(data, ensure_ascii=False)[:400])


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='application/json; charset=utf-8', extra_headers=None):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, b'')

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path in ('/', ''):
            path = '/index.html'
        # 防目录穿越
        full = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
        if not full.startswith(ROOT) or not os.path.isfile(full):
            self._send(404, 'Not Found', 'text/plain; charset=utf-8')
            return
        ext = os.path.splitext(full)[1].lower()
        ctype = MIME.get(ext, 'application/octet-stream')
        with open(full, 'rb') as f:
            self._send(200, f.read(), ctype)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            length = int(self.headers.get('Content-Length', 0) or 0)
            raw = self.rfile.read(length).decode('utf-8')
            req = json.loads(raw or '{}')
            if path == '/api/chat':
                self._handle_chat(req)
            elif path == '/api/vision':
                self._handle_vision(req)
            else:
                self._send(404, json.dumps({'error': 'not found'}, ensure_ascii=False))
        except Exception as e:
            self._send(500, json.dumps({'error': str(e)}, ensure_ascii=False))

    def _handle_chat(self, req):
        messages = req.get('messages', [])
        # 只保留 user/assistant，system 由后端统一在最前注入
        history = [m for m in messages if m.get('role') in ('user', 'assistant')]
        # 前端会附带实时学习数据（待办/目标/专注时长等），一并注入 system 提示词
        context = (req.get('context') or '').strip()
        sys_content = SYSTEM_PROMPT
        if context:
            sys_content += '\n\n# 当前学习数据（实时，供你提醒与建议）\n' + context
        full = [{'role': 'system', 'content': sys_content}] + history
        reply = call_llm(full)
        self._send(200, json.dumps({'reply': reply}, ensure_ascii=False))

    def _handle_vision(self, req):
        image = (req.get('image') or '').strip()
        prompt = (req.get('prompt') or '请详细描述这张图片。').strip()
        if not image:
            self._send(400, json.dumps({'error': '缺少 image 字段（base64 或 data URI）'}, ensure_ascii=False))
            return
        # 兼容纯 base64 与 data URI 两种传法
        if not image.startswith('data:'):
            image = 'data:image/png;base64,' + image
        reply = call_vision(prompt, image)
        self._send(200, json.dumps({'reply': reply}, ensure_ascii=False))

    def log_message(self, fmt, *args):
        sys.stderr.write('[%s] %s\n' % (self.log_date_time_string(), fmt % args))


def main():
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print('=' * 56)
    print(' TAKE YOUR ☾ TIME — AI 助手后端已启动')
    print(' 地址：http://localhost:%d' % PORT)
    print(' 模型：%s  (%s)' % (CFG['model'], CFG['base_url']))
    print(' 视觉：%s  (%s)' % (CFG['vision_model'], CFG['vision_base_url']))
    if not CFG['api_key']:
        print(' ⚠ 未检测到 API Key：请在 config.json 填入 api_key 后再使用对话。')
    else:
        print(' ✓ API Key 已加载')
    print(' 按 Ctrl+C 停止')
    print('=' * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止')


if __name__ == '__main__':
    main()
