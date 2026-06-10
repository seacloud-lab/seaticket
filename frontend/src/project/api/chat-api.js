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

  generateChatSessionTitle(projectUuid, sessionUuid, params) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/generate-title/';
    const data = {
      ...params,
      project_uuid: projectUuid,
    };
    return this.req.post(url, data);
  }

  getChatMessages(projectUuid, sessionUuid) {
    const url = this.server + '/api/v1/chat/sessions/' + sessionUuid + '/messages/?project_uuid=' + projectUuid;
    return Promise.resolve({ data: {
      'messages': [
        {
          'id': 4090,
          'session_uuid': '5e3bc58c-58c8-42f1-8dc6-4974f5437443',
          'message_id': '2408',
          'role': 'user',
          'content': 'Illogical behavior of SeaDrive',
          'attachments': [],
          'sources': [],
          'created_at': '2026-04-20T09:11:37.815043Z',
          'updated_at': '2026-04-20T09:11:37.815091Z',
          'as_context': true
        },
        {
          'id': 4091,
          'session_uuid': '5e3bc58c-58c8-42f1-8dc6-4974f5437443',
          'message_id': '2408',
          'role': 'assistant',
          'content': 'The "illogical behavior" of SeaDrive, such as continuous downloading of random files or the "Free space" option triggering downloads instead, is often caused by **third-party software (like Antivirus or Indexing services) accessing files** in the SeaDrive virtual drive[Reference 1].\n\n### Common Symptoms\n*   **Continuous downloading:** SeaDrive keeps downloading files even when you aren\'t using them, consuming bandwidth and disk space[Reference 1].\n*   **Failed "Free Space" action:** Attempting to free up space via the context menu results in the files being immediately re-downloaded[Reference 1].\n\n### Root Cause\nWhen an external program (e.g., ESET Nod32, Windows Search Indexer, or other security software) monitors or scans the SeaDrive process or the virtual drive folder, it "touches" the files. Since SeaDrive is a virtual drive, any attempt to read or scan a file placeholder triggers an automatic download from the server to provide the file content to the requesting program[Reference 1].\n\n### Recommended Solutions\n1.  **Exclude SeaDrive from Antivirus:** Add the SeaDrive executable (`seadrive.exe`) and the cache folder to the exclusion list of your antivirus or security software. This prevents the scanner from automatically triggering file downloads[Reference 1].\n2.  **Disable Search Indexing:** Ensure that Windows Search or other indexing tools are not trying to index the SeaDrive virtual drive letter or its cache directory.\n3.  **Check for Background Processes:** Use a tool like "Resource Monitor" (Network/Disk tabs) to see which process is accessing the files if the issue persists.\n\nThese steps generally resolve the "never-ending download" cycle and restore the expected behavior of the "Free space" feature[Reference 1].',
          'attachments': [],
          'sources': [
            {
              'type': 'discourse_forum',
              'connection_id': 223,
              '_id': 1,
              'modified_time': '2026-03-01T23:47:42.757Z',
              'title': 'Illogical behavior of SeaDrive',
              'ai_summary': 'User asks whether SeaDrive’s auto-downloading and space-freeing behavior is intentional or a bug.'
            }
          ],
          'created_at': '2026-04-20T09:11:37.816392Z',
          'updated_at': '2026-04-20T09:11:37.816437Z',
          'as_context': true,
          'thought_process': {
            'actions': [
              {
                'tool_calls': [
                  {
                    'name': 'documents_search',
                    'arguments': {
                      'query': 'SeaDrive illogical behavior troubleshooting known issues'
                    },
                    'execution_detail': {
                      '1. Keywords search': 'time usage: 0.03 s',
                      '2. Vector search': 'time usage: 0.38 s',
                      '3. Request title and ai_summary': 'time usage: 0.01 s',
                      '4. Rerank search records': 'time usage: 0.89 s; tokens usage: 569 (↑545 ↓24)',
                      '5. Requst whole data': 'time usage: 0.27 s'
                    }
                  }
                ],
                'completion_retry': [],
                'tool_retry': [],
                'token_usage': {
                  'input_tokens': 3078,
                  'output_tokens': 1065,
                  'total_tokens': 4143
                },
                'time_usage': 3.0248820781707764,
                'result': '```json\n[\n    {\n        "label": "<reference_0>",\n        "type": "site",\n        "title": "Drive Client - Seafile Admin Manual",\n        "modified_time": "2026-04-18T02:41:19Z",\n        "url": "https://manual.seafile.com/13.0/changelog/drive-client-changelog/"\n    }\n]\n```\n'
              },
              {
                'tool_calls': [
                  {
                    'name': 'issues_search',
                    'arguments': {
                      'query': 'SeaDrive illogical behavior'
                    },
                    'execution_detail': {
                      '1. Keywords search': 'time usage: 0.06 s',
                      '2. Vector search': 'time usage: 0.91 s',
                      '3. Request title and ai_summary': 'time usage: 0.07 s',
                      '4. Rerank search records': 'time usage: 0.93 s; tokens usage: 1827 (↑1803 ↓24)',
                      '5. Requst whole data': 'time usage: 0.02 s'
                    }
                  }
                ],
                'completion_retry': [],
                'tool_retry': [],
                'token_usage': {
                  'input_tokens': 10184,
                  'output_tokens': 2722,
                  'total_tokens': 12906
                },
                'time_usage': 5.305610656738281,
                'result': '```json\n[\n    {\n        "label": "<reference_1>",\n        "type": "discourse_forum",\n        "title": "Illogical behavior of SeaDrive",\n        "modified_time": "2026-03-01T23:47:42.757Z"\n    }\n]\n```\n'
              }
            ],
            'final_answer': {
              'result': 'The "illogical behavior" of SeaDrive, such as continuous downloading of random files or the "Free space" option triggering downloads instead, is often caused by **third-party software (like Antivirus or Indexing services) accessing files** in the SeaDrive virtual drive<reference_1>.\n\n### Common Symptoms\n*   **Continuous downloading:** SeaDrive keeps downloading files even when you aren\'t using them, consuming bandwidth and disk space<reference_1>.\n*   **Failed "Free Space" action:** Attempting to free up space via the context menu results in the files being immediately re-downloaded<reference_1>.\n\n### Root Cause\nWhen an external program (e.g., ESET Nod32, Windows Search Indexer, or other security software) monitors or scans the SeaDrive process or the virtual drive folder, it "touches" the files. Since SeaDrive is a virtual drive, any attempt to read or scan a file placeholder triggers an automatic download from the server to provide the file content to the requesting program<reference_1>.\n\n### Recommended Solutions\n1.  **Exclude SeaDrive from Antivirus:** Add the SeaDrive executable (`seadrive.exe`) and the cache folder to the exclusion list of your antivirus or security software. This prevents the scanner from automatically triggering file downloads<reference_1>.\n2.  **Disable Search Indexing:** Ensure that Windows Search or other indexing tools are not trying to index the SeaDrive virtual drive letter or its cache directory.\n3.  **Check for Background Processes:** Use a tool like "Resource Monitor" (Network/Disk tabs) to see which process is accessing the files if the issue persists.\n\nThese steps generally resolve the "never-ending download" cycle and restore the expected behavior of the "Free space" feature<reference_1>.',
              'reach_max_steps': false,
              'token_usage': {
                'input_tokens': 10311,
                'output_tokens': 364,
                'total_tokens': 10675
              },
              'time_usage': 5.15083909034729
            },
            'static': {
              'token_usage': {
                'input_tokens': {
                  'action_steps': 13262,
                  'answer_generation': 10311,
                  'total': 23573
                },
                'output_tokens': {
                  'action_steps': 3787,
                  'answer_generation': 364,
                  'total': 4151
                },
                'total_tokens': {
                  'action_steps': 17049,
                  'answer_generation': 10675,
                  'total': 27724
                }
              },
              'time_usage': {
                'action_steps': 8.330492734909058,
                'answer_generation': 5.15083909034729,
                'total': 13.481331825256348
              }
            },
            'task': {
              'system_prompt': 'You are an expert assistant capable of helping users handle tasks through tool calls. In short, **one of your most important tasks is to analyze the user\'s current task and the tools (and answers) already used to determine if additional tools are needed to complete the task. If so, return a tool call request; otherwise, answer the user\'s question based on the tool call history**. A specific logical example will be given here:\n\n- User: a task\n- Your reasoning: Tool A is needed for the user\'s task, so you return a tool call request: Tool A with some arguments\n- Execute Tool A, and return the result to you\n- You reason again and find another tool is needed to complete the user\'s task, so you return another tool call request: Tool B with some arguments\n- Execute Tool B, and return the result to you\n- You reason again and find the information obtained from past tool calls so far is sufficient to meet the user\'s task, then return your final answer (no longer a tool call request).\n\nYou may be asked for following kinds of tasks:\n- resolve an issue\n- analyze the issue and give some points that need to check to help solving the issue, instead of resolving the issue directly\n- summarize issues in a user\'s report if the report is long and contains several different issues \n- other general tasks \n\nPlease answer the user\'s question based on the provided reference materials or available tool calls (If the user\'s task does not require additional tools to perform the operation or assist in answering, please answer directly).  To do so, you have been given access to some tools. The tool call you write is an action: after the tool is executed, you will get the result of the tool call as an "observation". This Action/Observation can repeat 5 times (or steps), you should take several steps when needed, and MUST make a final answer once 5 steps is reached. \n\nYou must determine, based on the user\'s problem or task and your own experience, which tools are more suitable for solving the problem, or whether it can be solved without using any tools. For example (this is just a suggested approach; you should actually consider your own situation and the user\'s problem or task):\n- For tasks like summarizing a text or other problems that can be solved without reference materials: no tools are needed.\n- Always use the right arguments for the tools. Never use variable names as the action arguments, use the value instead.\n- Do not call tools unrelated to the question. \n- If you believe a user\'s question requires reference materials to resolve, you should (Unless otherwise stated):\n    1. In your **first step**, search official documentation to see if it addresses the user\'s concerns  (i.e., send a tool call request like `documents_search`). \n    2. If you\'ve already used a tool to search official documentation (e.g., `documents_search`), **then** you need to determine if the tool\'s results adequately answer your question. If not, you need to search for similar cases and past solutions (i.e., send another tool call request like `issues_search`, **do not use tools like issues_search in the first step**). \n    3. If the search tools mentioned above fail to provide satisfactory answers to user questions, you can try using other search tools (if they are available).\n- If the user wants to perform other specific operations, you can also check if there are tools that match the user\'s operations, and consider whether and how to call them. For example, you can use a content generation tool like `generate_markdown` to handle requests from users when they need you to provide a Markdown file.\n\nWe provide several tools, the following is a brief introduction:\n\n\n1. Reference material search tools (e.g., "documents_search"). When the user\'s question requires additional reference material to answer, you can try using these tools to search for the necessary reference material.\n    Unless otherwise specified, our search tools will return JSON information similar to the following:\n\n\n    ```json\n    [\n        {\n            "label": "<reference_0>",\n            "title": "Title",\n            "content": "Search result\'s content",\n            \n            // ... Other useful information, e.g., url ...\n        }, {\n            "label": "<reference_1>",\n            "title": "Title",\n            "content": "Search result\'s content",\n            \n            // ... Other useful information, e.g., url ...\n        }\n    ]\n    ```\n\n\n    For your response, unless otherwise stated, if you use these search tools and believe they provide valuable information for answering user questions, please insert the value of the "label" field of the search tool\'s search results in the appropriate place (usually in the format "<reference_xxx>", such as "<reference_0>", "<reference_1>"). Below is a relevant example:\n\n\n    - Example task 1: "What\'s Seafile?"\n        Then, you can use some of the provided tools to answer the question (**be sure to confirm that these tools are necessary to solve the problem, and avoid using unnecessary tools**). For example, you can use search tools to find the information needed to answer the question "What is Seafile?" (unless otherwise stated, you should first use document-type search tools such as `documents_search` to see if they can adequately answer the user\'s question, and then use issues search tools such as `issues_search` and other search tools).\n        - Step 1:\n            - Tool call:\n                {\n                    "name": "documents_search",\n                    "arguments": {\n                      "query": "introduction of seafile"\n                    }\n                }\n            - Tool\'s result: \n                ```json\n                [\n                    {\n                        "label": "<reference_0>",\n                        "title": "Seafile introduction",\n                        "content": "Seafile is an open source cloud storage system for file sync, share and document collaboration. Seafile has many extensions, and SeaDoc is the most important one which provide a lightweight online collaborative document feature.",\n                    }, {\n                        "label": "<reference_1>",\n                        "title": "Seafile system requirements",\n                        "content": "The system requirements of Seafile needs 2-cores CPU and 2-GB memory minimum ...",\n                    }, {\n                        "label": "<reference_2>",\n                        "title": "Deploy Seafile CE with Docker",\n                        "content": "To deploy Seafile CE with Docker, you should ...",\n                    }\n                ]\n                ```\n        - Reasoning: The document *Seafile introduction* with label `<reference_0>` now provides sufficient answers to the user\'s question, "What\'s Seafile?". So now that you have all the necessary answers or relevant operations, it\'s time to tell the user your final answer (i.e., your task is complete).\n        - Your response: Seafile is an open source cloud storage system for file sync, share and document collaboration<reference_0>. It supports a variety of extensions, among which SeaDoc is one of the most commonly used.\n\n\n    - Example task 2: "Which is the most popular programming language python or java?"\n        - Step 1: \n            - Tool call:\n                {\n                    "name": "documents_search",\n                    "arguments": {\n                      "query": "Python usage rate vs Java usage rate"\n                    }\n                }\n            - Tool\'s result: []\n        - Reasoning: No relevant search results were found in the document libraries, so search related information by similar cases (trying to use another type of search tool)\n        - Step 2:\n            - Tool call:\n                {\n                    "name": "issues_search",\n                    "arguments": "Python usage rate vs Java usage rate"\n                }\n            - Tool\'s result: \n                [\n                    {\n                        "label": "<reference_0>",\n                        "title": "Python APP consume a lot of memory",\n                        "content": "I wrote a Python program and a Java program using the same logic. However, the Python program consumes a lot of memory. Can someone tell me why?",\n                    }\n                ]\n        - Reasoning: Although search results exist, they are irrelevant to the user\'s question, so try to use another type of search tool\n        - Step 3\n            - Tool call:\n                {\n                    "name": "online_search", # if available\n                    "arguments": "Python usage rate vs Java usage rate"\n                }\n            - Tool\'s result: \n                [\n                    {\n                        "label": "<reference_1>",\n                        "title": "Python VS Java",\n                        "content": "Both Python and Java are Object-oriented programming languages"\n                    }, {\n                        "label": "<reference_2>",\n                        "title": "JetBrains Developer Ecosystem Survey 2024",\n                        "content": "JetBrains Developer Report: Python usage will reach 57% in 2024"\n                    }, {\n                        "label": "<reference_3>",\n                        "title": "JetBrains Developer Ecosystem Survey 2024",\n                        "content": "JetBrains Developer Report: Java usage will reach 37% in 2024"\n                    }\n                ]\n        - Reasoning: It is obvious that `<reference_2>` and `<reference_3>` provide very valuable reference information for answering the user\'s question, so you can now provide your answer:\n        - Your response: Some messages about python<reference_2>. Some messages about Java<reference_3>. Some summaries...\n\n\n    >[!NOTE]\n    >If you need to mark multiple references in one place, simply combine the corresponding label from the search result, such as "<reference_0><reference_2>"\n\n\n    Similarly, if the tools you are using do not include a search function, or if the search results are not particularly helpful in answering the user\'s question, please do not insert tags such as "<reference_xxx>" into your answer. Below is a relevant example:\n\n\n    Example task 3: Which one is the maximum value in 5, 9, 19, 28 and 3\n    - Tool call: none (you do not need to do any tool call for this question)\n    - Your response: the maximum value in your provided is 28\n\n\n2. Content generation tools (e.g., "generate_markdown", "create_knowledge_base_entry"). These types of tools are generally used to generate specific content (for example, you can try calling the "generate_markdown" tool when a user expects **certain content** to be recorded in a **Markdown file** or **document**, but not a proposal or statement).\n    Unless otherwise specified, such tools will return a closed HTML tag block, for example:\n    ```html\n    <!-- tool generate_markdown -->\n    <seaqa-markdown file_name=\'file_name.md\'>\n    Document content\n    </seaqa-markdown>\n\n\n    <!-- tool image_generator -->\n    <img url=\'xxx.png\' />\n    ```\n\n\n    Unless otherwise specified, if you use these tools, do not attempt to make any changes to their output (includes HTML tags and their content.) in your results. This is an example:\n\n\n    - Example task 4: Please record the your above answer into a Markdown document\n        - Step 1:\n            - Tool call: Tool `generate_markdown`\n            - Tool\'s result:\n                ```html\n                <seaqa-markdown file_name=\'file_name.md\'>\n                Document content\n                </seaqa-markdown>\n                ```\n        - Your response:\n            Okay, I\'ve recorded my answer above in a Markdown document:\n            <seaqa-markdown file_name=\'file_name.md\'>\n            Document content\n            </seaqa-markdown>\n\n    - Example task 5: Based on the discussion above, create a knowledge base entry for me\n        - Step 1:\n            - Tool call: Tool `create_knowledge_base_entry`\n            - Tool\'s result:\n                ```html\n                <seaqa-kb-entry id=\'1234\' title=\'How to install Seafile with Docker\' />\n                ```\n        - Your response:\n            Okay, I\'ve created a knowledge base entry based on our discussion:\n            <seaqa-kb-entry id=\'1234\' title=\'How to install Seafile with Docker\' />\n\n',
              'user_input': {
                'raw': 'Illogical behavior of SeaDrive',
                'message': 'Illogical behavior of SeaDrive',
                'attachments': []
              }
            }
          }
        }
      ],
      'running_task': false
    } });
    return this.req.get(url);
  }

  uploadChatImage(projectUuid, file, onUploadProgress) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/upload-file/';
    const formData = new FormData();
    formData.append('file', file);
    return this.req.post(url, formData, { onUploadProgress });
  }

}

const chatAPI = new ChatAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
chatAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { chatAPI };
