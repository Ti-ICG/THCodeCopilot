// import { fetchEventSource, FetchEventSourceInit } from '@microsoft/fetch-event-source';
// import _ from 'lodash';

export type LLMModel =
  | 'LM Studio Community/Meta-Llama-3-8B-Instruct-GGUF'
  | 'Qwen/CodeQwen1.5-7B-Chat-GGUF';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface ChatParams {
  model?: LLMModel;
  messages?: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface FetchEventSourceInitEx<T = any> extends RequestInit {
  data?: T;
  params?: Record<string, any>;
}

const baseURL = 'http://192.168.14.17:1234';

export const Prompts = {
  /** 代码解释 */
  //   codeExplainPrompt: `你是一名代码解释助手。你的任务是帮助开发者解释和分析任何编程语言中的代码，能够自动识别给定代码片段的编程语言。目标是提供简洁而全面的解释，即使是不熟悉该编程语言的人也能理解实现的逻辑。
  // 具体要求如下：
  //   1. Constraints: 专注于技术和编程相关话题。提供清晰、简洁的解释，适合所有级别的开发者，并确保对不熟悉特定语言的人来说是可接近的。尽可能避免使用技术术语，必要时进行解释。
  //   2. Guidelines: 提供代码功能、最佳实践、潜在优化和调试技巧的见解。自动识别编程语言，并使分析尽可能直接。欢迎代码片段分析并提供可行的反馈。
  //   3. Clarification: 当代码语言或目标不明确时请求澄清，但通过清晰而简洁的解释尽量减少这种需要。
  //   4. Personalization: 使用友好而专业的语气，旨在教育和协助开发者提高他们的编码技能，使代码背后的逻辑即使对那些不熟悉语言的人也是可理解的。
  //   请记住，回答时一定要用中文回答，并翻译每一行代码的意义。
  //   你要解释的代码如下：`,
  codeExplainPrompt: `你是一名代码解释助手。你的任务是帮助开发者解释和分析任何编程语言中的代码，能够自动识别给定代码片段的编程语言。目标是提供简洁而全面的解释，即使是不熟悉该编程语言的人也能理解实现的逻辑。
具体要求如下：
  1. Constraints: 专注于技术和编程相关话题。提供清晰、简洁的解释，适合所有级别的开发者，并确保对不熟悉特定语言的人来说是可接近的。尽可能避免使用技术术语，必要时进行解释。
  2. Guidelines: 提供代码功能、最佳实践、潜在优化和调试技巧的见解。自动识别编程语言，并使分析尽可能直接。欢迎代码片段分析并提供可行的反馈。
  3. Clarification: 当代码语言或目标不明确时请求澄清，但通过清晰而简洁的解释尽量减少这种需要。
  4. Personalization: 使用友好而专业的语气，旨在教育和协助开发者提高他们的编码技能，使代码背后的逻辑即使对那些不熟悉语言的人也是可理解的。
  请记住，注释一定要用中文，并翻译每一行代码的意义，以代码的原始格式输出。
  你要解释的代码如下：
  `,
};

export function fetchEx(url: string, options: FetchEventSourceInitEx) {
  options.method = options.method || 'get';
  switch (options.method.toLocaleLowerCase()) {
    case 'post':
      if (options.body) {
        break;
      }

      if (options.data instanceof FormData) {
        // fetch调用post请求时，如果body是formdata，不能指定ContentType，否则报错
        options.body = options.data;
        if (options.headers) {
          // @ts-ignore
          if (typeof options.headers?.delete === 'function') {
            // @ts-ignore
            options.headers?.delete();
          } else {
            delete options.headers['Content-Type'];
          }
        }
      } else {
        options.headers = Object.assign(options.headers || {}, {
          'Content-Type': 'application/json',
        });
        // if (typeof options.data === 'string') {
        //   options.body = options.data
        // } else if (options.data instanceof Object) {
        // }
        options.body = JSON.stringify(options.data);
      }
      options.data = undefined;
      break;
  }

  let query = '';
  if (options.params != null) {
    if (typeof options.params === 'string') {
      query = options.params;
    } else if (options.params instanceof Object) {
      query = new URLSearchParams(options.params).toString();
    }
    options.params = undefined;
  }
  url += query ? `?${query}` : '';

  return fetch(baseURL + url, options).then(async (res) => {
    return await res.json();
  });
}

export interface ChatResult {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: 'stop';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
export function chatApi(options: FetchEventSourceInitEx<ChatParams>): Promise<ChatResult> {
  if (options.data) {
    // options.data = _.merge({}, options.data, {
    //   model: 'Qwen/CodeQwen1.5-7B-Chat-GGUF',
    //   stream: true,
    //   temperature: 0.7,
    //   max_tokens: 1024,
    // });
    options.data = Object.assign(
      {
        model: 'Qwen/CodeQwen1.5-7B-Chat-GGUF',
        stream: false,
        temperature: 0.7,
        max_tokens: -1,
      },
      options.data
    );
  }
  options.method = 'post';
  return fetchEx('/v1/chat/completions', options);
}
