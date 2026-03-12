# 翻译文件语法检查工具

## 功能简介

过滤翻译文件中的注释行和空翻译行，使用 DeepSeek API 检查英文语法，并生成记录。

## 快速开始

### 1. 安装依赖

```bash
pip install requests
```

### 2. 配置API密钥

编辑 `po_grammar_checker.py`，设置您的DeepSeek API密钥：

```python
DEEPSEEK_API_KEY = "your_api_key_here"
```

### 3. 运行脚本
```bash
python po_grammar_checker.py
```

## 输出文件
- `djangojs.po.clean` - 清理后的文件
- `djangojs.po.grammar_corrections.md` - 修正文件（如有错误）

## 处理流程
1. 复制原始文件 → `.clean` 文件，避免直接修改原始文件
2. 过滤注释行和空翻译行
3. 使用 DeepSeek API 检查每个英文句子的语法，修正错误并保存记录
4. 显示处理结果，人工检查并修改原始代码中的翻译字符串
