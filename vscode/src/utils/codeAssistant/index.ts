import { chatchatByOpenAI } from '../../api/modules/langchain-chatchat_v3';
import { FetchExRequestOptions, SSEOptions } from '../http/fetch.type';
import { EventSourceMessage } from '../http/sse.type';
import { chatApi } from './api';
import { openaiCompletions } from '../../api/modules/langchain-chatchat_v3';
import { Client } from '../../libs/@gradio/client';
import uuid from '../uuid';
import { fetchEx } from '../http/fetch';
import * as vscode from 'vscode';

let codeCompletionAbortController: AbortController = null;
let lastRequest;
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
  codeExplainPrompt: `你是一名编程助手。你的任务是帮助开发者解释和分析任何编程语言中的代码并增加注释，能够自动识别给定代码片段的编程语言。目标是提供简洁而全面的解释，即使是不熟悉该编程语言的人也能理解实现的逻辑。
具体要求如下：
  1. Constraints: 专注于技术和编程相关话题。提供清晰、简洁的解释，适合所有级别的开发者，并确保对不熟悉特定语言的人来说是可接近的。尽可能避免使用技术术语，必要时进行解释。
  2. Guidelines: 提供代码功能、最佳实践、潜在优化和调试技巧的见解。自动识别编程语言，并使分析尽可能直接。欢迎代码片段分析并提供可行的反馈。
  3. Clarification: 当代码语言或目标不明确时请求澄清，但通过清晰而简洁的解释尽量减少这种需要。
  4. Personalization 好而专业的语气，旨在教育和协助开发者提高他们的编码技能，使代码背后的逻辑即使对那些不熟悉语言的人也是可理解的。
  5. Reserved: 为每一行代码增加注释，并保留代码的原始格式，包括制表符、换行符、空格等。
  请记住，一定要用中文输出。
  你要解释的代码如下：
  `,
};

class CodeAssistant {
  static async explain(filename: string, code: string, options?: FetchExRequestOptions) {
    let result = '';
    try {
      await chatchatByOpenAI({
        ...options,
        sse: {
          messageType: 'SSE',
          onmessage(msg: EventSourceMessage) {
            try {
              const json = JSON.parse(msg.data);
              result += json.choices?.[0]?.delta?.content || '';
            } catch (error) {}
          },
        },
        data: {
          // model: 'CodeQwen1.5-7B-Chat',
          model: 'glm-4-9b-chat-1m',
          temperature: 0.35,
          stream: true,
          messages: [
            {
              role: 'system',
              content: `用中文对以下代码进行注释，并且必须保留代码的原始格式及缩进空格：
\`\`\`
${code}
\`\`\``,
              // content: Prompts.codeExplainPrompt + `\`\`\`${code}\`\`\``,
              //           content: `你是一名编程助手，你的任务是帮助开发者解释和分析任何编程语言中的代码并增加注释，能够自动识别给定代码片段的编程语言，具体要求如下：
              // - 必须保留代码的原始格式（如换行符、空格、制表符等）
              // - 如果这段代码内有定义函数(包括匿名函数)或方法，请给这个函数生成对应语言的注释文档（例如：js语言生成jsdoc文档），如果是调用函数或方法，则不需要此操作；
              // - 必须以中文输出；
              // - 必须保留原始注释和代码；`,
            },
            //           {
            //             role: 'user',
            //             // content: Prompts.codeExplainPrompt + `\`\`\`${code}\`\`\``,
            //             content: `处理这段代码：
            // \`\`\`${code}\`\`\``,
            //           },
            //           {
            //             role: 'user',
            //             // content: Prompts.codeExplainPrompt + `\`\`\`${code}\`\`\``,
            //             content: `请分析下面代码，给出每行的代码注释，保留第一行空格，具体代码如下：
            // \`\`\`
            // ${code}
            // \`\`\`
            // `,
            //           },
          ],
        },
      });
      let output = result;

      const markdownCodeReg = /```(?:\w+)?\s*([\s\S]+?)\s*```/;
      if (markdownCodeReg.test(output)) {
        output = output.match(markdownCodeReg)[1];
      }

      return output;
    } catch (error) {
      throw error;
    }
  }

  static async codeCompletion(code: string) {
    try {
      // let requestId = new Date().getTime();
      // lastRequest = requestId;
      // await new Promise((f) => setTimeout(f, 300));
      // if (lastRequest !== requestId) {
      //   // 这里做了消抖处理
      //   return { completions: [] };
      // }

      if (codeCompletionAbortController != null) {
        codeCompletionAbortController.abort('Cancel');
      }

      codeCompletionAbortController = new AbortController();

      const prompt = code;

      // const res = await fetch('http://54.252.195.195/v1/completions', {
      //   method: 'post',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     Authorization: '',
      //   },
      //   body: JSON.stringify({
      //     model: 'gpt-3.5-turbo-instruct',
      //     prompt: code,
      //     max_tokens: 50,
      //     temperature: 0.8,
      //     n: 1,
      //   }),
      // });

      // const app = await Client.connect('http://192.168.14.17:9997/CodeQwen1.5-7B/');
      // const res = await app.predict(
      //   '/complete',
      //   [
      //     prompt,
      //     50, // number (numeric value between 1 and 8192) in 'Max Tokens' Slider component
      //     0.45, // number (numeric value between 0 and 2) in 'Temperature' Slider component
      //     '', // string  in 'LoRA Name' Textbox component
      //   ],
      //   true
      // );

      let resultCode = '';
      const session_hash = uuid(3, {
        len: 11,
      });
      const queueJoinRes = await fetchEx('http://192.168.14.17:9997/CodeQwen1.5-7B/queue/join', {
        method: 'post',
        data: {
          data: [
            prompt,
            null,
            50, // number (numeric value between 1 and 8192) in 'Max Tokens' Slider component
            1, // number (numeric value between 0 and 2) in 'Temperature' Slider component
            '', // string  in 'LoRA Name' Textbox component
          ],
          event_data: null,
          fn_index: 0,
          session_hash: session_hash,
          trigger_id: 7,
        },
      });
      const queueDataRes = await fetchEx('http://192.168.14.17:9997/CodeQwen1.5-7B/queue/data', {
        method: 'get',
        params: {
          session_hash: session_hash,
        },
        sse: {
          messageType: 'SSE',
          onmessage(msg) {
            const message = JSON.parse(msg.data) as CodeQWenMessage;

            console.log(message);
            if (message.msg === 'process_generating') {
              const data = message.output?.data[0]?.[0];
              if (data?.[0] === 'append') {
                resultCode += data[2];
              }
            }
          },
        } as SSEOptions<'SSE'>,
      });
      let codeArray = [resultCode];
      // let codeArray: string[] = [((res?.data?.[0] as string) || '').replace(prompt, '')]; // res.choices.map((item) => item.text);
      const completions = Array<string>();
      for (let i = 0; i < codeArray.length; i++) {
        const completion = codeArray[i];
        if (!completion) continue;

        let tmpstr = completion;
        if (tmpstr.trim() === '') continue;
        if (completions.includes(completion)) continue;
        completions.push(completion);
      }
      // let timeEnd = new Date().getTime();
      // console.log(timeEnd - time1, timeEnd - time2);
      return { completions, commandid: '123' };
    } catch (error) {
      codeCompletionAbortController = null;
      if (error?.message === 'Cancel') {
        console.log('getCodeCompletions', '取消补全');
        return { completions: [], commandid: '123' };
      }
      throw error;
    }
  }
  static async codeCompletionByFIM(textBeforeCursor: string, textAfterCursor: string) {
    try {
      // let requestId = new Date().getTime();
      // lastRequest = requestId;
      // await new Promise((f) => setTimeout(f, 300));
      // if (lastRequest !== requestId) {
      //   // 这里做了消抖处理
      //   return { completions: [] };
      // }

      if (codeCompletionAbortController != null) {
        codeCompletionAbortController.abort('Cancel');
      }

      codeCompletionAbortController = new AbortController();

      const prompt = `<fim_prefix>${textBeforeCursor}<fim_suffix>${textAfterCursor}<fim_middle>`;

      // const res = await fetch('http://54.252.195.195/v1/completions', {
      //   method: 'post',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     Authorization: '',
      //   },
      //   body: JSON.stringify({
      //     model: 'gpt-3.5-turbo-instruct',
      //     prompt: code,
      //     max_tokens: 50,
      //     temperature: 0.8,
      //     n: 1,
      //   }),
      // });

      // const app = await Client.connect('http://192.168.14.17:9997/CodeQwen1.5-7B/');
      // const res = await app.predict(
      //   '/complete',
      //   [
      //     prompt,
      //     50, // number (numeric value between 1 and 8192) in 'Max Tokens' Slider component
      //     0.45, // number (numeric value between 0 and 2) in 'Temperature' Slider component
      //     '', // string  in 'LoRA Name' Textbox component
      //   ],
      //   true
      // );

      let resultCode = '';
      const session_hash = uuid(3, {
        len: 11,
      });
      const queueJoinRes = await fetchEx('http://192.168.14.17:9997/CodeQwen1.5-7B/queue/join', {
        method: 'post',
        data: {
          data: [
            prompt,
            null,
            50, // number (numeric value between 1 and 8192) in 'Max Tokens' Slider component
            1, // number (numeric value between 0 and 2) in 'Temperature' Slider component
            '', // string  in 'LoRA Name' Textbox component
          ],
          event_data: null,
          fn_index: 0,
          session_hash: session_hash,
          trigger_id: 7,
        },
      });
      const queueDataRes = await fetchEx('http://192.168.14.17:9997/CodeQwen1.5-7B/queue/data', {
        method: 'get',
        params: {
          session_hash: session_hash,
        },
        sse: {
          messageType: 'SSE',
          onmessage(msg) {
            const message = JSON.parse(msg.data) as CodeQWenMessage;

            console.log(message);
            if (message.msg === 'process_generating') {
              const data = message.output?.data[0]?.[0];
              if (data?.[0] === 'append') {
                resultCode += data[2];
              }
            }
          },
        } as SSEOptions<'SSE'>,
      });
      // debugger;
      // const res = await directRequestModel({
      //   url: '/CodeQwen1.5-7B',
      //   data: [prompt, 50, 0.7, null],
      // });
      let codeArray = [resultCode];
      // let codeArray: string[] = [((res?.data?.[0] as string) || '').replace(prompt, '')]; // res.choices.map((item) => item.text);
      const completions = Array<string>();
      for (let i = 0; i < codeArray.length; i++) {
        const completion = codeArray[i];
        if (!completion) continue;

        let tmpstr = completion;
        if (tmpstr.trim() === '') continue;
        if (completions.includes(completion)) continue;
        completions.push(completion);
      }
      // let timeEnd = new Date().getTime();
      // console.log(timeEnd - time1, timeEnd - time2);
      return { completions, commandid: '123' };
    } catch (error) {
      codeCompletionAbortController = null;
      if (error?.message === 'Cancel') {
        console.log('getCodeCompletions', '取消补全');
        return { completions: [], commandid: '123' };
      }
      throw error;
    }
  }
}

interface CodeQWenMessageMap {
  estimation;
  process_starts: {
    eta: number;
  };
  process_generating: {
    output: {
      data: any[];
      is_generating: boolean;
      duration: number;
      average_duration: number;
    };
    success: boolean;
  };
  close_stream;
}

interface CodeQWenMessageBase<T extends keyof CodeQWenMessageMap> {
  msg: T;
  event_id: string;
}
type CodeQWenMessageType<T extends keyof CodeQWenMessageMap> = CodeQWenMessageBase<T> &
  CodeQWenMessageMap[T];

interface CodeQWenMessage<T extends keyof CodeQWenMessageMap = keyof CodeQWenMessageMap> {
  msg: T;
  event_id: string;

  eta?: number;

  output?: {
    data: any[];
    is_generating: boolean;
    duration: number;
    average_duration: number;
  };
  success?: boolean;
}

export default CodeAssistant;
