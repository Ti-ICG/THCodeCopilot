import type { EventSourceMessage } from './sse.type';

export interface SSEMessageType {
  SSE: EventSourceMessage;
  PlainText: string;
}
export interface SSEOptions<T extends keyof SSEMessageType = keyof SSEMessageType> {
  openWhenHidden?: boolean;
  /** 内容类型
   * - SSE 标准sse数据结构，例如: event: message \n data: hello \n
   * - PlainText 纯文本，有一些接口返回的是纯文本，如果使用SSE去解析会导致无法解析到数据
   */
  messageType?: T;
  /** @deprecated */
  decoder?: {
    decode(input: ReadableStreamReadResult<Uint8Array>): any;
  };
  onopen?: () => Promise<void>;
  onmessage?: (msg: SSEMessageType[T]) => void;
  onclose?: () => void;
  onerror?: (err: Error) => void;
}

export interface FetchExRequestOptions<T = RequestInit['body'] | Record<string, any>>
  extends RequestInit {
  baseURL?: string;
  url?: string;
  params?: Record<string, any> | string;
  data?: T;
  /** 超时时间，传入0表示无限等待 */
  timeout?: number;
  // /** 是否为流式传输，默认为false */
  // stream?: boolean
  /** 是否自动根据响应头中的ContentType解析数据，默认为false */
  autoParse?: boolean;
  /** 服务端推送参数，传入此参数表示开启流式传输*/
  sse?: SSEOptions;
  // onDownloadProgress?: (per: number) => void
  // onUploadProgress?: (per: number) => void
}
export interface CancellablePromise<T> extends Promise<T> {
  cancel(resaon?: any): void;
}
