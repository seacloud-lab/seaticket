import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '../../constants';

class ChatAPI {

  init({ server, username, password, token }) {
    this.server = server;
    this.username = username;
    this.password = password;
    this.token = token;
    if (this.token && this.server) {
      this.req = axios.create({
        baseURL: this.server,
        headers: { 'Authorization': 'Token ' + this.token }
      });
    }
    return this;
  }

  initForUsage({ siteRoot, xcsrfHeaders }) {
    if (siteRoot && siteRoot.charAt(siteRoot.length - 1) === '/') {
      var server = siteRoot.substring(0, siteRoot.length - 1);
      this.server = server;
    } else {
      this.server = siteRoot;
    }

    this.req = axios.create({
      headers: {
        'X-CSRFToken': xcsrfHeaders,
      }
    });
    return this;
  }

  login() {
    const url = this.server + '/api2/auth-token/';
    return axios.post(url, {
      username: this.username,
      password: this.password
    }).then((response) => {
      this.token = response.data.token;
      this.req = axios.create({
        baseURL: this.server,
        headers: { 'Authorization': 'Token ' + this.token }
      });
    });
  }

  _sendPostRequest(url, form) {
    if (form.getHeaders) {
      return this.req.post(url, form, {
        headers: form.getHeaders()
      });
    } else {
      return this.req.post(url, form);
    }
  }

  sendChatMessage(params, options) {
    const url = this.server + '/api/v1/ai/chat/';
    return this._sendPostRequest(url, params);
  }

  _handleEventStreamRequest(url, form, options = {}) {
    let body = form;
    let headers = { ...options.headers };
    if (!headers['X-CSRFToken']) {
      const csrfToken = Cookies.get('seaqa_csrftoken');
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }
    }
    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = 'Token ' + this.token;
    }
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (!form) {
      return fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
        signal: options.signal,
      });
    }

    if (form.getHeaders) {
      body = form;
      const formHeaders = form.getHeaders();
      headers = { ...headers, ...formHeaders };
    } else if (typeof form === 'object') {
      body = JSON.stringify(form);
    }
    return fetch(url, {
      method: 'POST',
      body: body,
      headers: headers,
      credentials: 'include',
      signal: options.signal,
    });
  }

  sendChatMessageByStream(params, options = {}) {
    const url = this.server + '/api/v1/ai/chat/';
    return this._handleEventStreamRequest(url, params, options);
  }

  getChatMessage(projectUuid, sessionId) {
    const url = this.server + '/api/v1/ai/chat/?session_uuid=' + sessionId;
    return this.req.get(url);
  }

  getChatMessageByStream(projectUuid, sessionId, streamed_length, options) {
    const url = this.server + '/api/v1/ai/chat/?session_uuid=' + sessionId + '&streamed_length=' + streamed_length;
    return this._handleEventStreamRequest(url, undefined, options);
  }

  // chat sessions api
  listChatSessions(projectUuid) {
    const url = this.server + '/api/v1/chat/sessions/?project_uuid=' + projectUuid;
    return this.req.get(url);
  }

  listTeamSharedSessions(projectUuid) {
    const url = this.server + '/api/v1/chat/sessions/?project_uuid=' + projectUuid + '&type=team';
    return this.req.get(url);
  }

  shareChatSession(projectUuid, sessionUuid, isShared) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/';
    const data = {
      project_uuid: projectUuid,
      is_shared: isShared
    };
    return this.req.put(url, data);
  }

  createChatSession(projectUuid, sessionName) {
    const url = this.server + '/api/v1/chat/sessions/';
    const data = {
      project_uuid: projectUuid,
      session_name: sessionName,
    };
    return this.req.post(url, data);
  }

  deleteChatSession(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/';
    const data = {
      project_uuid: projectUuid
    };
    return this.req.delete(url, { data });
  }

  modifyChatSession(projectUuid, sessionUuid, update) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/';
    const data = {
      ...update,
      project_uuid: projectUuid
    };
    return this.req.put(url, data);
  }

  getChatMessages(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/messages/?project_uuid=' + projectUuid;
    return Promise.resolve({ data: {
      'messages': [
        {
          'id': 4369,
          'session_uuid': '59aca9b1-be57-49fe-b155-34b2cea6ac3a',
          'message_id': '61e3',
          'role': 'user',
          'content': '@旧版 Seafile 上传文件失败：启用“支持文件上传',
          'attachments': [
            {
              'type': 'ticket',
              'record_id': 3,
              'state': 'open',
              'title': '旧版 Seafile 上传文件失败：启用“支持文件上传”后重启',
              'content': '您好！若在旧版 Seafile 中出现上传文件失败，请先检查应用程序设置，确保已启用“支持文件上传”。操作步骤：1）打开 Seafile 应用的设置菜单；2）查找与文件上传相关的选项；3）将“支持文件上传”切换为启用；4）保存设置后重启应用，再尝试上传文件。\n\nRelated record: https://github.com/yinjianfei-user/yinjianfei-test-repository/issues/7',
              'created_time': '2026-04-27T09:22:49.148639+00:00',
              'comments': []
            }
          ],
          'sources': [],
          'created_at': '2026-04-28T09:55:56.106250Z',
          'updated_at': '2026-04-28T09:55:56.106291Z',
          'as_context': true
        },
        {
          'id': 4370,
          'session_uuid': '59aca9b1-be57-49fe-b155-34b2cea6ac3a',
          'message_id': '61e3',
          'role': 'assistant',
          'content': '针对您提供的关于“旧版 Seafile 上传文件失败”的问题，建议按照以下步骤进行排查和修复：\n\n1.  **检查应用设置**：进入 Seafile 应用的设置菜单。\n2.  **启用上传选项**：在设置中查找并确保已开启“支持文件上传”选项。\n3.  **重启应用**：保存上述设置更改后，必须**重启 Seafile 应用**以使配置生效。\n4.  **重新测试**：重启后再次尝试上传文件。\n\n此外，该问题可能与已知记录相关，您可以参考相关的 Issue 详情：[GitHub Issue #7](https://github.com/yinjianfei-user/yinjianfei-test-repository/issues/7)。',
          'attachments': [],
          'sources': [],
          'created_at': '2026-04-28T09:55:56.107098Z',
          'updated_at': '2026-04-28T09:55:56.107117Z',
          'as_context': true,
          'thought_process': {
            'actions': [],
            'final_answer': {
              'result': '针对您提供的关于“旧版 Seafile 上传文件失败”的问题，建议按照以下步骤进行排查和修复：\n\n1.  **检查应用设置**：进入 Seafile 应用的设置菜单。\n2.  **启用上传选项**：在设置中查找并确保已开启“支持文件上传”选项。\n3.  **重启应用**：保存上述设置更改后，必须**重启 Seafile 应用**以使配置生效。\n4.  **重新测试**：重启后再次尝试上传文件。\n\n此外，该问题可能与已知记录相关，您可以参考相关的 Issue 详情：[GitHub Issue #7](https://github.com/yinjianfei-user/yinjianfei-test-repository/issues/7)。',
              'reach_max_steps': false,
              'token_usage': {
                'input_tokens': 1738,
                'output_tokens': 200,
                'total_tokens': 1938
              },
              'time_usage': 1.8971803188323975
            },
            'static': {
              'token_usage': {
                'input_tokens': {
                  'action_steps': 0,
                  'answer_generation': 1738,
                  'total': 1738
                },
                'output_tokens': {
                  'action_steps': 0,
                  'answer_generation': 200,
                  'total': 200
                },
                'total_tokens': {
                  'action_steps': 0,
                  'answer_generation': 1938,
                  'total': 1938
                }
              },
              'time_usage': {
                'action_steps': 0,
                'answer_generation': 1.8971803188323975,
                'total': 1.8971803188323975
              }
            },
            'task': {
              'system_prompts': [
                'You are a task-focused assistant that can either call tools or answer directly.\n\nDecide what is needed at each step:\n- If the task still needs information or execution from an available tool, return tool call(s).\n- If the task can already be completed, no suitable tool exists, tool access is disabled, or the request does not need tools, return the final answer.\n\nPriorities:\n- Solve the user\'s actual request, not a broader version of it.\n- Prefer the smallest sufficient action.\n- Do not over-search, over-call tools, or repeat unhelpful tool calls.\n- Do not reveal chain-of-thought, hidden reasoning, or internal planning.\n\nYou may need to resolve issues, analyze likely causes, summarize reports, answer product questions, or complete other general tasks.\n\nTool use can continue for up to 4 steps. Step 5 must be a final answer based only on information already available.',
                'Global tool rules:\n- Do not call tools when the request can be answered well without them.\n- Call only tools that are relevant to the current task.\n- Use concrete argument values. Do not use variable names, placeholders, or meta descriptions as tool arguments.\n- Do not make speculative, random, or redundant tool calls.\n- Do not fabricate tool results, references, files, records, or execution status.\n- If no suitable tool is available, answer directly with the best available information.\n- If a tool result is already sufficient, stop calling tools and answer.\n\nSearch policy:\n- Use search tools only when the answer needs external reference material.\n- Start with `documents_search` unless the user explicitly asks for issue history, past cases, or ticket-like records.\n- If `documents_search` is sufficient, stop searching and answer.\n- Use `issues_search` only after documentation is insufficient, or when the user explicitly asks for issue-style evidence.\n- Use any other search tool only if the earlier search steps are insufficient and that tool is available.\n- Search queries should be short natural-language sentences, not keyword piles.\n- Do not perform exploratory searches without a clear reason tied to the user\'s request.\n\nSearch reference rules:\n- Search tools may return records with a `label` such as `<reference_0>`.\n- Only use those labels as citations in the final answer.\n- Cite only the statements that are actually supported by the search results.\n- If several references support the same statement, place the labels together, for example `<reference_0><reference_3>`.\n- If search results are irrelevant, weak, or unused in the answer, do not cite them.\n- If no search tool was used, do not output any `<reference_x>` tags.\n\nSearch examples:\n\nExample 1\nUser: What\'s Seafile?\nTool call:\n{\n  "name": "documents_search",\n  "arguments": {\n    "query": "introduction of seafile"\n  }\n}\nTool result includes `<reference_0>` with a Seafile introduction.\nFinal answer: Seafile is an open source cloud storage system for file sync, sharing, and document collaboration<reference_0>.\n\nExample 2\nUser: Has this kind of LDAP login problem happened before?\nStep 1 tool call:\n{\n  "name": "documents_search",\n  "arguments": {\n    "query": "LDAP login issue after upgrade"\n  }\n}\nStep 1 result is insufficient.\nStep 2 tool call:\n{\n  "name": "issues_search",\n  "arguments": {\n    "query": "LDAP login issue after upgrade"\n  }\n}\nStep 2 result includes `<reference_1>` and `<reference_2>`.\nFinal answer: Similar upgrade-related LDAP login issues have been reported before<reference_1><reference_2>.\n\nExample 3\nUser: Which number is largest in 5, 9, 19, 28, and 3?\nTool call: none\nFinal answer: 28.\n\nContent-generation rules:\n- Use content-generation tools only when the user explicitly asks to create, record, save, or generate content as an artifact.\n- Do not use content-generation tools for ordinary discussion, explanation, brainstorming, or recommendation requests.\n- `generate_markdown` is for producing a Markdown document artifact.\n- `create_knowledge_base_entry` is for creating a knowledge-base record from the current discussion.\n- After a content-generation tool returns its result, preserve that returned tag block exactly.\n- If content-generation tools are not available, answer in normal text and do not pretend that content was created.\n\nContent-generation examples:\n\nExample 1\nUser: Put the answer above into a Markdown document.\nTool call:\n{\n  "name": "generate_markdown",\n  "arguments": {\n    "file_name": "answer.md",\n    "content": "# Title\n\nDocument content"\n  }\n}\nTool result:\n<seaqa-markdown file_name="answer.md">\n# Title\n\nDocument content\n</seaqa-markdown>\nFinal answer:\nI recorded it in a Markdown document.\n<seaqa-markdown file_name="answer.md">\n# Title\n\nDocument content\n</seaqa-markdown>\n\nExample 2\nUser: Create a knowledge base entry from this discussion.\nTool call:\n{\n  "name": "create_knowledge_base_entry",\n  "arguments": {\n    "title": "How to install Seafile with Docker",\n    "content": "# How to install Seafile with Docker"\n  }\n}\nTool result:\n<seaqa-kb-entry id="1234" title="How to install Seafile with Docker" />\nFinal answer:\nI created the knowledge base entry.\n<seaqa-kb-entry id="1234" title="How to install Seafile with Docker" />',
                'Output format rules:\n- Each response must do exactly one thing: either return tool call(s) or return the final user-facing answer.\n- Do not mix tool calls with a natural-language final answer in the same response.\n- Do not output fake tool-call JSON, pseudo-XML, or protocol text unless the user explicitly asks for that format.\n\nWhen tools are needed:\n- If key information is missing and a suitable tool exists, respond with tool call(s) only.\n- Do not add explanations such as "I will search" or "Let me call a tool".\n\nWhen tools are not needed:\n- If the answer can be given directly, tools are unavailable, or the maximum step has been reached, return a final answer only.\n- Do not claim that you performed an action unless a tool actually performed it.\n\nWhen search tools were used:\n- Cite only with labels returned by tool results, such as <reference_0>.\n- Place citations immediately after the supported statement.\n- Combine multiple citations directly, such as <reference_0><reference_2>.\n- Do not output any <reference_x> tag if search tools were not used or the results are not useful.\n\nWhen content-generation tools were used:\n- You may add one short user-facing sentence before the generated content.\n- Then output the returned tag block exactly as the tool returned it.\n- Do not rewrite, wrap, or handcraft tool output tags such as <seaqa-markdown> or <seaqa-kb-entry>.'
              ],
              'user_input': {
                'raw': 'Here are some tickets, issues or email in Json format with title, content and comments. \n\n```json\n[\n    {\n        "type": "ticket",\n        "record_id": 3,\n        "state": "open",\n        "title": "旧版 Seafile 上传文件失败：启用“支持文件上传”后重启",\n        "content": "您好！若在旧版 Seafile 中出现上传文件失败，请先检查应用程序设置，确保已启用“支持文件上传”。操作步骤：1）打开 Seafile 应用的设置菜单；2）查找与文件上传相关的选项；3）将“支持文件上传”切换为启用；4）保存设置后重启应用，再尝试上传文件。\\n\\nRelated record: https://github.com/yinjianfei-user/yinjianfei-test-repository/issues/7",\n        "created_time": "2026-04-27T09:22:49.148639+00:00",\n        "comments": []\n    }\n]\n```\n\n@旧版 Seafile 上传文件失败：启用“支持文件上传',
                'message': '@旧版 Seafile 上传文件失败：启用“支持文件上传',
                'attachments': [
                  {
                    'type': 'ticket',
                    'record_id': 3,
                    'state': 'open',
                    'title': '旧版 Seafile 上传文件失败：启用“支持文件上传”后重启',
                    'created_time': '2026-04-27T09:22:49.148639+00:00'
                  }
                ]
              }
            }
          }
        },
        {
          'id': 4387,
          'session_uuid': '59aca9b1-be57-49fe-b155-34b2cea6ac3a',
          'message_id': '1e4c',
          'role': 'user',
          'content': '帮我解决一下',
          'attachments': [],
          'sources': [],
          'created_at': '2026-04-29T02:59:48.353892Z',
          'updated_at': '2026-04-29T02:59:48.354014Z',
          'as_context': true
        },
        {
          'id': 4388,
          'session_uuid': '59aca9b1-be57-49fe-b155-34b2cea6ac3a',
          'message_id': '1e4c',
          'role': 'assistant',
          'content': '针对“旧版 Seafile 上传文件失败”的问题，根据现有记录，您可以尝试以下两步解决方案：\n\n### 1. 启用并重启（基础修复方案）\n根据相关工单和 Issue 的记录，建议先通过以下步骤进行修复：\n- **操作步骤**：\n  1. 打开 Seafile 应用程序的 **设置菜单**。\n  2. 查找与文件上传相关的选项，确保 **“支持文件上传”** 已切换为 **启用** 状态。\n  3. **保存设置并重启应用**。重启是使该配置生效的关键步骤[Reference 1][Reference 2][Reference 3]。\n\n### 2. 检查配额限制（进阶修复方案）\n如果完成上述操作后仍提示上传失败，并伴随类似“资源超过限制”的报错，可能与存储配额有关：\n- **排查建议**：请检查您的账户或存储库是否已超过分配的存储容量限制，这也会导致上传功能失效[Reference 4]。\n\n如果问题依然存在，请确认您的版本号或提供更具体的错误信息。',
          'attachments': [],
          'sources': [
            {
              'type': 'ticket',
              'connection_id': 'ticket',
              '_id': 3,
              'modified_time': '2026-04-27T09:22:49.148639Z',
              'title': '旧版 Seafile 上传文件失败：启用“支持文件上传”后重启',
              'ai_summary': 'Fix old Seafile file upload failures by enabling “support file upload” and restarting.'
            },
            {
              'type': 'github_issue',
              'connection_id': 309,
              '_id': 7,
              'modified_time': '2026-04-20T08:11:13Z',
              'title': '旧版的seafile上传文件显示失败怎么解决',
              'ai_summary': 'Old Seafile file uploads fail; need guidance to fix the issue.'
            },
            {
              'type': 'github_issue',
              'connection_id': 311,
              '_id': 7,
              'modified_time': '2026-04-20T08:11:13Z',
              'title': '旧版的seafile上传文件显示失败怎么解决',
              'ai_summary': 'Old Seafile file uploads fail; need guidance to fix the issue.'
            },
            {
              'type': 'email',
              'connection_id': 312,
              '_id': 6,
              'modified_time': '2026-04-20T09:48:07Z',
              'title': '旧版的seafile上传文件显示失败怎么解决',
              'ai_summary': 'Troubleshooting Seafile old upload failure showing an error when uploading files'
            }
          ],
          'created_at': '2026-04-29T02:59:48.355200Z',
          'updated_at': '2026-04-29T02:59:48.355228Z',
          'as_context': true,
          'thought_process': {
            'actions': [
              {
                'tool_calls': [
                  {
                    'name': 'issues_search',
                    'arguments': {
                      'query': '旧版 Seafile 上传文件失败 启用“支持文件上传”后重启'
                    },
                    'execution_detail': {
                      '1. Keywords search': 'time usage: 0.04 s',
                      '2. Vector search': 'time usage: 0.43 s',
                      '3. Request title and ai_summary': 'time usage: 0.11 s',
                      '4. Rerank search records': 'time usage: 1.53 s; tokens usage: 2171 (↑2086 ↓85)',
                      '5. Requst whole data': 'time usage: 0.12 s'
                    }
                  }
                ],
                'completion_retry': [],
                'tool_retry': [],
                'token_usage': {
                  'input_tokens': 4040,
                  'output_tokens': 258,
                  'total_tokens': 4298
                },
                'time_usage': 3.164308786392212,
                'result': '```json\n[\n    {\n        "label": "<reference_0>",\n        "type": "ticket",\n        "title": "旧版 Seafile 上传文件失败：启用“支持文件上传”后重启",\n        "modified_time": "2026-04-27T09:22:49.148639Z"\n    },\n    {\n        "label": "<reference_1>",\n        "type": "github_issue",\n        "title": "旧版的seafile上传文件显示失败怎么解决",\n        "modified_time": "2026-04-20T08:11:13Z"\n    },\n    {\n        "label": "<reference_2>",\n        "type": "github_issue",\n        "title": "旧版的seafile上传文件显示失败怎么解决",\n        "modified_time": "2026-04-20T08:11:13Z"\n    },\n    {\n        "label": "<reference_3>",\n        "type": "email",\n        "title": "旧版的seafile上传文件显示失败怎么解决",\n        "modified_time": "2026-04-20T09:48:07Z"\n    },\n    {\n        "label": "<reference_4>",\n        "type": "discourse_forum",\n        "title": "Cannot upload or edit files on Seahub after upgrade vom V11 to V12",\n        "modified_time": "2025-04-26T01:02:32.122Z"\n    }\n]\n```\n'
              }
            ],
            'final_answer': {
              'result': '针对“旧版 Seafile 上传文件失败”的问题，根据现有记录，您可以尝试以下两步解决方案：\n\n### 1. 启用并重启（基础修复方案）\n根据相关工单和 Issue 的记录，建议先通过以下步骤进行修复：\n- **操作步骤**：\n  1. 打开 Seafile 应用程序的 **设置菜单**。\n  2. 查找与文件上传相关的选项，确保 **“支持文件上传”** 已切换为 **启用** 状态。\n  3. **保存设置并重启应用**。重启是使该配置生效的关键步骤<reference_0><reference_1><reference_2>。\n\n### 2. 检查配额限制（进阶修复方案）\n如果完成上述操作后仍提示上传失败，并伴随类似“资源超过限制”的报错，可能与存储配额有关：\n- **排查建议**：请检查您的账户或存储库是否已超过分配的存储容量限制，这也会导致上传功能失效<reference_3>。\n\n如果问题依然存在，请确认您的版本号或提供更具体的错误信息。',
              'reach_max_steps': false,
              'token_usage': {
                'input_tokens': 9574,
                'output_tokens': 323,
                'total_tokens': 9897
              },
              'time_usage': 2.5785138607025146
            },
            'static': {
              'token_usage': {
                'input_tokens': {
                  'action_steps': 4040,
                  'answer_generation': 9574,
                  'total': 13614
                },
                'output_tokens': {
                  'action_steps': 258,
                  'answer_generation': 323,
                  'total': 581
                },
                'total_tokens': {
                  'action_steps': 4298,
                  'answer_generation': 9897,
                  'total': 14195
                }
              },
              'time_usage': {
                'action_steps': 3.164308786392212,
                'answer_generation': 2.5785138607025146,
                'total': 5.742822647094727
              }
            },
            'task': {
              'system_prompts': [
                'You are a task-focused assistant that can either call tools or answer directly.\n\nDecide what is needed at each step:\n- If the task still needs information or execution from an available tool, return tool call(s).\n- If the task can already be completed, no suitable tool exists, tool access is disabled, or the request does not need tools, return the final answer.\n\nPriorities:\n- Solve the user\'s actual request, not a broader version of it.\n- Prefer the smallest sufficient action.\n- Do not over-search, over-call tools, or repeat unhelpful tool calls.\n- Do not reveal chain-of-thought, hidden reasoning, or internal planning.\n\nYou may need to resolve issues, analyze likely causes, summarize reports, answer product questions, or complete other general tasks.\n\nTool use can continue for up to 4 steps. Step 5 must be a final answer based only on information already available.',
                'Global tool rules:\n- Do not call tools when the request can be answered well without them.\n- Call only tools that are relevant to the current task.\n- Use concrete argument values. Do not use variable names, placeholders, or meta descriptions as tool arguments.\n- Do not make speculative, random, or redundant tool calls.\n- Do not fabricate tool results, references, files, records, or execution status.\n- If no suitable tool is available, answer directly with the best available information.\n- If a tool result is already sufficient, stop calling tools and answer.\n\nSearch policy:\n- Use search tools only when the answer needs external reference material.\n- Start with `documents_search` unless the user explicitly asks for issue history, past cases, or ticket-like records.\n- If `documents_search` is sufficient, stop searching and answer.\n- Use `issues_search` only after documentation is insufficient, or when the user explicitly asks for issue-style evidence.\n- Use any other search tool only if the earlier search steps are insufficient and that tool is available.\n- Search queries should be short natural-language sentences, not keyword piles.\n- Do not perform exploratory searches without a clear reason tied to the user\'s request.\n\nSearch reference rules:\n- Search tools may return records with a `label` such as `<reference_0>`.\n- Only use those labels as citations in the final answer.\n- Cite only the statements that are actually supported by the search results.\n- If several references support the same statement, place the labels together, for example `<reference_0><reference_3>`.\n- If search results are irrelevant, weak, or unused in the answer, do not cite them.\n- If no search tool was used, do not output any `<reference_x>` tags.\n\nSearch examples:\n\nExample 1\nUser: What\'s Seafile?\nTool call:\n{\n  "name": "documents_search",\n  "arguments": {\n    "query": "introduction of seafile"\n  }\n}\nTool result includes `<reference_0>` with a Seafile introduction.\nFinal answer: Seafile is an open source cloud storage system for file sync, sharing, and document collaboration<reference_0>.\n\nExample 2\nUser: Has this kind of LDAP login problem happened before?\nStep 1 tool call:\n{\n  "name": "documents_search",\n  "arguments": {\n    "query": "LDAP login issue after upgrade"\n  }\n}\nStep 1 result is insufficient.\nStep 2 tool call:\n{\n  "name": "issues_search",\n  "arguments": {\n    "query": "LDAP login issue after upgrade"\n  }\n}\nStep 2 result includes `<reference_1>` and `<reference_2>`.\nFinal answer: Similar upgrade-related LDAP login issues have been reported before<reference_1><reference_2>.\n\nExample 3\nUser: Which number is largest in 5, 9, 19, 28, and 3?\nTool call: none\nFinal answer: 28.\n\nContent-generation rules:\n- Use content-generation tools only when the user explicitly asks to create, record, save, or generate content as an artifact.\n- Do not use content-generation tools for ordinary discussion, explanation, brainstorming, or recommendation requests.\n- `generate_markdown` is for producing a Markdown document artifact.\n- `create_knowledge_base_entry` is for creating a knowledge-base record from the current discussion.\n- After a content-generation tool returns its result, preserve that returned tag block exactly.\n- If content-generation tools are not available, answer in normal text and do not pretend that content was created.\n\nContent-generation examples:\n\nExample 1\nUser: Put the answer above into a Markdown document.\nTool call:\n{\n  "name": "generate_markdown",\n  "arguments": {\n    "file_name": "answer.md",\n    "content": "# Title\n\nDocument content"\n  }\n}\nTool result:\n<seaqa-markdown file_name="answer.md">\n# Title\n\nDocument content\n</seaqa-markdown>\nFinal answer:\nI recorded it in a Markdown document.\n<seaqa-markdown file_name="answer.md">\n# Title\n\nDocument content\n</seaqa-markdown>\n\nExample 2\nUser: Create a knowledge base entry from this discussion.\nTool call:\n{\n  "name": "create_knowledge_base_entry",\n  "arguments": {\n    "title": "How to install Seafile with Docker",\n    "content": "# How to install Seafile with Docker"\n  }\n}\nTool result:\n<seaqa-kb-entry id="1234" title="How to install Seafile with Docker" />\nFinal answer:\nI created the knowledge base entry.\n<seaqa-kb-entry id="1234" title="How to install Seafile with Docker" />',
                'Output format rules:\n- Each response must do exactly one thing: either return tool call(s) or return the final user-facing answer.\n- Do not mix tool calls with a natural-language final answer in the same response.\n- Do not output fake tool-call JSON, pseudo-XML, or protocol text unless the user explicitly asks for that format.\n\nWhen tools are needed:\n- If key information is missing and a suitable tool exists, respond with tool call(s) only.\n- Do not add explanations such as "I will search" or "Let me call a tool".\n\nWhen tools are not needed:\n- If the answer can be given directly, tools are unavailable, or the maximum step has been reached, return a final answer only.\n- Do not claim that you performed an action unless a tool actually performed it.\n\nWhen search tools were used:\n- Cite only with labels returned by tool results, such as <reference_0>.\n- Place citations immediately after the supported statement.\n- Combine multiple citations directly, such as <reference_0><reference_2>.\n- Do not output any <reference_x> tag if search tools were not used or the results are not useful.\n\nWhen content-generation tools were used:\n- You may add one short user-facing sentence before the generated content.\n- Then output the returned tag block exactly as the tool returned it.\n- Do not rewrite, wrap, or handcraft tool output tags such as <seaqa-markdown> or <seaqa-kb-entry>.'
              ],
              'user_input': {
                'raw': '帮我解决一下',
                'message': '帮我解决一下',
                'attachments': []
              }
            },
            'context': [
              {
                'date': '2026-04-28T09:55:56.106250+00:00',
                'assistant_response': [
                  {
                    'date': '2026-04-28T09:55:56.107098+00:00',
                    'content': {
                      'answer': '针对您提供的关于“旧版 Seafile 上传文件失败”的问题，建议按照以下步骤进行排查和修复：\n\n1.  **检查应用设置**：进入 Seafile 应用的设置菜单。\n2.  **启用上传选项**：在设置中查找并确保已开启“支持文件上传”选项。\n3.  **重启应用**：保存上述设置更改后，必须**重启 Seafile 应用**以使配置生效。\n4.  **重新测试**：重启后再次尝试上传文件。\n\n此外，该问题可能与已知记录相关，您可以参考相关的 Issue 详情：[GitHub Issue #7](https://github.com/yinjianfei-user/yinjianfei-test-repository/issues/7)。',
                      'sources': []
                    }
                  }
                ],
                'user_input': {
                  'attachments': [
                    {
                      'type': 'ticket',
                      'record_id': 3,
                      'state': 'open',
                      'title': '旧版 Seafile 上传文件失败：启用“支持文件上传”后重启',
                      'content': '您好！若在旧版 Seafile 中出现上传文件失败，请先检查应用程序设置，确保已启用“支持文件上传”。操作步骤：1）打开 Seafile 应用的设置菜单；2）查找与文件上传相关的选项；3）将“支持文件上传”切换为启用；4）保存设置后重启应用，再尝试上传文件。\n\nRelated record: https://github.com/yinjianfei-user/yinjianfei-test-repository/issues/7',
                      'created_time': '2026-04-27T09:22:49.148639+00:00',
                      'comments': []
                    }
                  ],
                  'message': '@旧版 Seafile 上传文件失败：启用“支持文件上传',
                  'raw': 'Here are some tickets, issues or email in Json format with title, content and comments. \n\n```json\n[\n    {\n        "type": "ticket",\n        "record_id": 3,\n        "state": "open",\n        "title": "旧版 Seafile 上传文件失败：启用“支持文件上传”后重启",\n        "content": "您好！若在旧版 Seafile 中出现上传文件失败，请先检查应用程序设置，确保已启用“支持文件上传”。操作步骤：1）打开 Seafile 应用的设置菜单；2）查找与文件上传相关的选项；3）将“支持文件上传”切换为启用；4）保存设置后重启应用，再尝试上传文件。\\n\\nRelated record: https://github.com/yinjianfei-user/yinjianfei-test-repository/issues/7",\n        "created_time": "2026-04-27T09:22:49.148639+00:00",\n        "comments": []\n    }\n]\n```\n\n@旧版 Seafile 上传文件失败：启用“支持文件上传'
                }
              }
            ]
          }
        }
      ],
      'running_task': false
    } });
    return this.req.get(url);
  }

}

const chatAPI = new ChatAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
chatAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { chatAPI };
