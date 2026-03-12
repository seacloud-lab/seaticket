#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import requests
import json
import re
from datetime import datetime

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_API_KEY = "xxxxxxxxxxxxxxxxxxxxx"

def check_grammar_with_deepseek(sentence):
    """
    Use DeepSeek API to check the grammar of the sentence
    return: (is_correct, corrected_sentence)
    """
    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY == "YOUR_DEEPSEEK_API_KEY_HERE":
        print(f"警告: 未设置DeepSeek API密钥，跳过语法检查: {sentence}")
        return True, sentence
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    prompt = f"""
    请检查以下英文句子的语法是否正确。如果语法正确，请返回原始句子；如果语法不正确，请返回修正后的句子。
    
    句子: "{sentence}"
    
    请严格按照以下JSON格式返回结果:
    {{
        "is_correct": true/false,
        "corrected_sentence": "修正后的句子或原始句子"
    }}
    """
    
    data = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": "你是一个专业的英文语法检查器。请只返回JSON格式的结果，不要添加任何额外的解释。"
            },
            {
                "role": "user", 
                "content": prompt
            }
        ],
        "temperature": 0.1,
        "max_tokens": 500
    }
    
    try:
        response = requests.post(DEEPSEEK_API_URL, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            grammar_result = json.loads(json_match.group())
            is_correct = grammar_result.get("is_correct", True)
            corrected_sentence = grammar_result.get("corrected_sentence", sentence)
            return is_correct, corrected_sentence
        else:
            print(f"警告: 无法解析API响应: {content}")
            return True, sentence
            
    except requests.exceptions.RequestException as e:
        print(f"API请求错误: {e}")
        return True, sentence
    except json.JSONDecodeError as e:
        print(f"JSON解析错误: {e}")
        return True, sentence
    except Exception as e:
        print(f"语法检查错误: {e}")
        return True, sentence

def clean_po_content(content):
    content = content.strip().strip('"')
    content = re.sub(r'\s+', ' ', content).strip()
    return content

def write_grammar_corrections_to_file(corrections, output_file):
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# 语法修正记录\n")
        f.write(f"# 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"# 总修正数量: {len(corrections)}\n\n")
        for i, correction in enumerate(corrections, 1):
            f.write(f"## 修正记录 {i}\n")
            f.write(f"原句: {correction['original']}\n")
            f.write(f"修正后: {correction['corrected']}\n")
            f.write(f"文件位置: {correction['file_position']}\n")
            f.write("-" * 50 + "\n\n")

def process_po_file(file_path):
    """
    处理指定的PO文件
    """
    if not os.path.exists(file_path):
        print(f"错误: 文件不存在: {file_path}")
        return False
    
    clean_path = f"{file_path}.clean"
    corrections_file = f"{file_path}.grammar_corrections.md"    
    shutil.copy2(file_path, clean_path)
    print(f"已创建新文件: {clean_path}")
    
    with open(clean_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    grammar_checked_lines = []
    grammar_corrections = []
    
    for line_num, line in enumerate(lines, 1):
        if not line.startswith('#') and not line.startswith('msgstr ""'):
            if line.startswith('msgid'):
                original_content = line.replace('msgid', '', 1).lstrip()
                cleaned_content = clean_po_content(original_content)
                
                if cleaned_content and len(cleaned_content) > 5:
                    print(f"检查句子: {cleaned_content}")                    
                    is_correct, corrected_content = check_grammar_with_deepseek(cleaned_content)
                    if not is_correct:
                        print(f"语法错误! 原句: {cleaned_content}")
                        print(f"修正后: {corrected_content}")
                        correction_record = {
                            'original': cleaned_content,
                            'corrected': corrected_content,
                            'file_position': f"第{line_num}行"
                        }
                        grammar_corrections.append(correction_record)
                        corrected_line = f'msgid "{corrected_content}"\n'
                        grammar_checked_lines.append(corrected_line)
                    else:
                        print(f"语法正确: {cleaned_content}")
                        grammar_checked_lines.append(line)
                else:
                    grammar_checked_lines.append(line)
            else:
                grammar_checked_lines.append(line)
        else:
            grammar_checked_lines.append(line)
    
    temp_path = f"{file_path}.tmp"
    with open(temp_path, 'w', encoding='utf-8') as f:
        f.writelines(grammar_checked_lines)
    
    original_lines = len(lines)
    new_lines = len(grammar_checked_lines)
    removed_count = original_lines - new_lines
    
    shutil.move(temp_path, clean_path)
    
    if grammar_corrections:
        write_grammar_corrections_to_file(grammar_corrections, corrections_file)
        print(f"语法修正记录已保存到: {corrections_file}")
        print(f"共修正了 {len(grammar_corrections)} 个语法错误")
    else:
        print("未发现语法错误")
    
    print(f"处理完成！删除了 {removed_count} 行以 '#' 开头的行和以 'msgstr \"\"' 开头的行")
    print(f"成功处理文件: {clean_path}")

def main():
    po_files = [
        "./locale/en/LC_MESSAGES/djangojs.po",
        "./locale/en/LC_MESSAGES/django.po"
    ]
    for file_path in po_files:        
        process_po_file(file_path)
if __name__ == "__main__":
    main()
