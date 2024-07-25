// import { fetchEventSource, FetchEventSourceInit } from '@microsoft/fetch-event-source';
// import _ from 'lodash';

import axios, { Canceler } from 'axios';
import { fetchEx } from '../http/fetch.js';
import { FetchExRequestOptions } from '../http/fetch.type';

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

// const baseURL = 'http://192.168.14.17:1234';
const baseURL = 'http://10.19.64.101:8000';
// const baseURL = 'http://172.16.2.165:1234';
type a = PromiseConstructor;
export class CancellablePromise<T> extends Promise<T> {
  #canceller;
  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void
    ) => void,
    canceller: ((reason?: string) => void) | AbortController
  ) {
    super(executor);
    this.#canceller = canceller;
  }
  cancel(reason?: string) {
    try {
      if (this.#canceller instanceof AbortController) {
        this.#canceller.abort(new Error(reason));
      } else if (typeof this.#canceller === 'function') {
        this.#canceller(reason);
      }
    } catch (error) {
      console.error('Cancellation error:', error);
    }
  }
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>
  ): CancellablePromise<TResult1 | TResult2> {
    const newPromise = super.then(onfulfilled, onrejected) as CancellablePromise<
      TResult1 | TResult2
    >;
    newPromise.cancel = this.cancel.bind(this);
    newPromise.#canceller = this.#canceller;
    return newPromise;
  }
  // 如果需要继承 Promise 的其他方法，请确保覆盖它们
  catch<TResult = never>(
    onrejected?: (reason: any) => TResult | PromiseLike<TResult>
  ): CancellablePromise<T | TResult> {
    const newPromise = super.catch(onrejected) as CancellablePromise<T | TResult>;
    newPromise.cancel = this.cancel.bind(this);
    newPromise.#canceller = this.#canceller;
    return newPromise;
  }

  // 如果需要继承 Promise 的其他方法，请确保覆盖它们
  finally(onfinally?: () => void): CancellablePromise<T> {
    const newPromise = super.finally(onfinally) as CancellablePromise<T>;
    newPromise.cancel = this.cancel.bind(this);
    newPromise.#canceller = this.#canceller;
    return newPromise;
  }
}

// export function fetchEx(url: string, options: FetchEventSourceInitEx) {
//   options.method = options.method || 'get';
//   switch (options.method.toLocaleLowerCase()) {
//     case 'post':
//       if (options.body) {
//         break;
//       }

//       if (options.data instanceof FormData) {
//         // fetch调用post请求时，如果body是formdata，不能指定ContentType，否则报错
//         options.body = options.data;
//         if (options.headers) {
//           // @ts-ignore
//           if (typeof options.headers?.delete === 'function') {
//             // @ts-ignore
//             options.headers?.delete();
//           } else {
//             delete options.headers['Content-Type'];
//           }
//         }
//       } else {
//         options.headers = Object.assign(options.headers || {}, {
//           'Content-Type': 'application/json',
//         });
//         // if (typeof options.data === 'string') {
//         //   options.body = options.data
//         // } else if (options.data instanceof Object) {
//         // }
//         options.body = JSON.stringify(options.data);
//       }
//       options.data = undefined;
//       break;
//   }

//   let query = '';
//   if (options.params != null) {
//     if (typeof options.params === 'string') {
//       query = options.params;
//     } else if (options.params instanceof Object) {
//       query = new URLSearchParams(options.params).toString();
//     }
//     options.params = undefined;
//   }
//   url += query ? `?${query}` : '';

//   const abortController = new AbortController();
//   options.signal = abortController.signal;

//   return new CancellablePromise<any>(async (resolve, reject) => {
//     try {
//       const res = await fetch(baseURL + url, options);
//       const text = await res.text();

//       let result;
//       try {
//         result = JSON.parse(text);
//       } catch (error) {
//         result = text;
//       }
//       resolve(result);
//     } catch (error) {
//       if (error == abortController.signal.reason) {
//       }
//       reject(error);
//     }
//   }, abortController);
// }

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

export function chatApi(
  options: FetchExRequestOptions<ChatParams>
): CancellablePromise<ChatResult> {
  if (options.data) {
    // options.data = _.merge({}, options.data, {
    //   model: 'Qwen/CodeQwen1.5-7B-Chat-GGUF',
    //   stream: true,
    //   temperature: 0.7,
    //   max_tokens: 1024,
    // });
    options.data = Object.assign(
      {
        // model: 'Qwen/CodeQwen1.5-7B-Chat-GGUF',
        // model: 'gpt-4o',
        model: 'CodeQwen1.5-7B-Chat',
        // model: 'LM Studio Community/Meta-Llama-3-8B-Instruct-GGUF',
        stream: false,
        temperature: 0.35,
        max_tokens: 4096,
      },
      options.data
    );
  }
  options.method = 'post';
  options.timeout = 60000;
  return fetchEx(baseURL + '/v1/chat/completions', options);
}

export function chatgptApi(
  options: FetchExRequestOptions<ChatParams>
): CancellablePromise<ChatResult> {
  options.data = Object.assign(
    {
      model: 'gpt-4o',
      stream: false,
      temperature: 0.35,
      max_tokens: 4096,
    },
    options.data || {}
  );
  options.method = 'post';
  options.headers = {
    Authorization: ``,
  };
  return fetchEx('http://54.252.195.195/v1/chat/completions/v1/chat/completions', options);
}
