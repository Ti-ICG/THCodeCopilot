// import request from '@/api/request'

import { objectToFormData } from '../../utils';
import services from '../services';
import { fetchEx } from '../../utils/http/fetch';
// import { fetchEventSource } from '@microsoft/fetch-event-source'
import type {
  CancellablePromise,
  FetchExRequestOptions,
  SSEOptions,
} from '../../utils/http/fetch.type';
import { merge, trimEnd } from 'lodash-es';
import { RequestErrorCode } from '../errorCode';
import type {
  OpenAIChatParams,
  OpenAIChatResponse,
  OpenAICompletionParams,
  OpenAICompletionResponse,
} from '../types/langchain-chatchat_v3';
import { method } from 'lodash';
import uuid from '../../utils/uuid';

function chatGLMRequest<T>({
  url = '',
  ...options
}: FetchExRequestOptions & {
  url?: string;
  returnRawData?: boolean;
} = {}) {
  const controller = new AbortController();
  options.signal?.addEventListener(
    'abort',
    () => {
      controller.abort(options.signal?.reason);
    },
    { once: true }
  );

  if (options.sse && !options.sse.messageType) {
    options.sse.messageType = 'SSE';
  }

  options.baseURL = options.baseURL || 'http://192.168.14.17:7861';
  if (options.baseURL) {
    url = options.baseURL + url;
  }
  // else if (websiteConfig.service?.url) {
  //   url = websiteConfig.service?.url + url
  // }

  // @ts-ignore
  const result: CancellablePromise<T> = fetchEx(url!, {
    ...options,
    signal: controller.signal,
    timeout: 60000,
    // sse: {
    //   // decoder: {
    //   //   decode() {
    //   //     return SSEDataParser.getMessages
    //   //   }
    //   // }
    // }
  })
    .then(async (res) => {
      if (res.status === 200) {
        if (res.bodyUsed) {
          return res;
        }

        let data;
        try {
          data = await res.json();
        } catch (error) {
          data = await res.text();
        }

        if (options.returnRawData) {
          return data;
        }

        if (typeof data === 'object') {
          if (data.code && data.code !== 200) {
            throw new Error(data.msg);
          }
          return data.data;
        }
        return data;
      }

      // @ts-ignore
      throw new Error(`${res.status} ${res.statusText}`, {
        cause: res.status,
      });
    })
    .catch((err) => {
      if (err?.message !== RequestErrorCode.Cancel.code) {
        // @ts-ignore
        throw new Error(RequestErrorCode.Busy.message, {
          cause: RequestErrorCode.Busy.code,
        });
      }
      throw err;
    });
  result.cancel = () => {
    controller.abort(RequestErrorCode.Cancel.code);
  };
  return result;
}

export interface BaseResponse<T> {
  code: number;
  msg: string;
  data?: T;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type LLMModel =
  | 'chatglm-6b'
  | 'chatglm-6b-int4'
  | 'chatglm2-6b'
  | 'chatglm2-6b-32k'
  | 'chatglm3-6b'
  | 'vicuna-13b-hf'
  | 'gpt-3.5-turbo'
  | 'baichuan2-13b'
  | 'internlm-20b'
  | 'qianfan-api'
  | 'wenxin-api'
  | 'openai-api'
  | 'zhipu-api'
  | 'Qwen1.5-14B-Chat';

const defaultLLMModel = 'glm-4';
// const defaultLLMModel = 'qianfan-api'

export interface ChatFunctionPrompt {
  /** 函数名称。后续模型会在需要调用函数时返回此名称。 */
  name: string;
  /** 函数功能描述。模型通过该描述理解函数能力，并判断是否需要调用该函数。 */
  description: string;
  parameters: {
    type: 'object';
    /** 函数所需的参数。以对象的形式描述函数所需的参数，其中对象的 key 即为参数名。 */
    properties: {
      [key: string]: {
        description: string;
        type: 'string' | 'object' | 'number' | 'boolean' | 'array' | 'null';
        enum?: string[];
      };
    };
    /** 必填参数的参数名列表。 */
    required: string[];
  };
}

export interface ChatParams {
  /**
   * Chat Model Config，LLM 模型配置
   */
  chat_model_config?: { [key: string]: any };
  /**
   * Conversation Id，对话框ID
   */
  conversation_id?: string;
  /**
   * History，历史对话，设为一个整数可以从数据库中读取历史消息
   */
  history?: ChatMessage[];
  /**
   * History Len，从数据库中取历史消息的数量
   */
  history_len?: number;
  /**
   * Message Id，数据库消息ID
   */
  message_id?: string;
  /**
   * Metadata，附件，可能是图像或者其他功能
   */
  metadata?: { [key: string]: any };
  /**
   * Query，用户输入
   */
  query: string;
  /**
   * Stream，流式输出
   */
  stream?: boolean;
  /**
   * Tool Config，工具配置
   */
  tool_config?: { [key: string]: any };
  model_name?: string;
  [property: string]: any;
}

export interface KbChatParams extends ChatParams {
  knowledge_id: string;
  /**
   * Top K，匹配向量数
   */
  top_k?: number;
  /**
   * Max Tokens，限制LLM生成Token数量，默认None代表模型最大值
   */
  max_tokens?: number | null;

  /**
   * Score Threshold，知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右
   */
  score_threshold?: number;
  /**
   * Temperature，LLM 采样温度
   */
  temperature?: number;

  /**
   * Prompt Name，使用的prompt模板名称(在configs/_prompt_config.py中配置)
   */
  prompt_name?: string;
}

const defaultChatParams: Partial<ChatParams> = {
  temperature: 0.7,
  model_name: defaultLLMModel,
  max_tokens: 2048,
  prompt_name: 'default',
};

const defaultKbChatParams: Partial<KbChatParams> = {
  model_name: defaultLLMModel,
  max_tokens: 2048,
  prompt_name: 'default',
  temperature: 0.7,
  score_threshold: 0.65,
  top_k: 5,
};

// export interface ChatMessage {
//   question?: string
//   response?: string
//   history?: Array<Array<string>>
//   source_documents?: string[]
// }

function checkChatParamsByModel(params: ChatParams | KbChatParams | OpenAIChatParams) {
  if (params.model_name !== 'openai-api' && params.history && params.history.length > 6) {
    let newhistory;

    if (params.history[0].role === 'system') {
      // 前2，后4，需要满足一问一答，且偶数
      newhistory = [params.history[0], params.history[1], ...params.history.slice(-4)];
    } else {
      newhistory = params.history.slice(-6);
    }
    params.history = newhistory;
  }

  switch (params.model_name) {
    case 'openai-api':
      // options.data.temperature = 0.7
      params.max_tokens = 4096;
      break;
    case 'zhipu-api':
      params.temperature = 0.1;
      params.max_tokens = 4096;
      break;
    case 'wenxin-api':
    case 'qianfan-api':
      params.temperature = 0.1;
      if (params.history) {
        const firstMsg = params.history[0];
        if (firstMsg && firstMsg.role !== 'user') {
          if (firstMsg.role === 'system') {
            firstMsg.role = 'user';
          } else {
            params.history.unshift({
              role: 'user',
              content: '',
            });
          }
        }
      }
      break;
    // case 'qianfan-api':
    //   options.data.history = []
    //   break
  }
}

//#region ChatChat对话

/**
 * 与llm模型对话(通过LLMChain)
 * @param data
 * @returns
 */
export function chatchat(options: FetchExRequestOptions<ChatParams>): CancellablePromise<string> {
  // data.streaming = true
  if (options.data) {
    options.data = merge({}, defaultChatParams, options.data);

    checkChatParamsByModel(options.data);
  }
  // if (options.sse) {
  //   options.sse.messageType = 'PlainText'
  // }
  return chatGLMRequest({
    ...options,
    url: '/chat/chat',
    method: 'post',
  });
}
/**
 * 与临时文件对话
 */
export function fileChat(
  options: FetchExRequestOptions<KbChatParams>,
  type?: 'default' | 'translate' | 'summary'
): CancellablePromise<{ answer: string; docs: string[] }> {
  // data.streaming = true
  if (options.data) {
    options.data = merge({}, defaultKbChatParams, options.data);

    checkChatParamsByModel(options.data);
  }

  return chatGLMRequest({
    ...options,
    url: '/chat/file_chat',
    method: 'post',
  });
}

export function chatchatByOpenAI(
  options: FetchExRequestOptions<OpenAIChatParams>
): Promise<OpenAIChatResponse> {
  // data.streaming = true

  if (options.data) {
    options.data = merge({}, options.data);

    // checkChatParamsByModel(options.data)
  }
  // if (options.sse) {
  //   options.sse.messageType = 'PlainText'
  // }
  return chatGLMRequest({
    ...options,

    url: '/chat/chat/completions',
    // url: services.chatglm + '/Chat/chat',
    method: 'post',
  });
}
//#endregion

// #region 知识库聊天

/**
 * 获取知识库列表
 * @returns 返回知识库列表
 */
export function listKnowledgeBases(): Promise<string[]> {
  return chatGLMRequest({
    url: '/knowledge_base/list_knowledge_bases',
    // url: services.chatglm + '/Chat/chat',
    method: 'get',
  });
}

/**
 * 创建知识库
 * @returns
 */
export function createKnowledgeBase(data: {
  /**
   * Embed Model
   */
  embed_model?: string;
  /**
   * Kb Info，知识库内容简介，用于Agent选择知识库。
   */
  kb_info?: string;
  /**
   * Knowledge Base Name
   */
  knowledge_base_name: string;
  /**
   * Vector Store Type
   */
  vector_store_type?: string;
}): Promise<string[]> {
  data = merge(
    {
      vector_store_type: 'faiss',
      embed_model: 'bge-reranker-large',
    },
    data
  );
  return chatGLMRequest({
    url: '/knowledge_base/create_knowledge_base',
    method: 'get',
  });
}

/**
 * 删除知识库
 * @returns
 */
export function deleteKnowledgeBase(name: string): Promise<void> {
  return chatGLMRequest({
    url: '/knowledge_base/delete_knowledge_base',
    method: 'post',
    data: name,
  });
}

/**
 * 获取知识库内的文件列表
 * @returns
 */
export function listFiles(knowledge_base_name: string): Promise<void> {
  return chatGLMRequest({
    url: '/knowledge_base/list_files',
    method: 'post',
    params: {
      knowledge_base_name,
    },
  });
}

/**
 * 搜索知识库
 * @returns
 */
export function searchDocs(data: {
  /**
   * File Name，文件名称，支持 sql 通配符
   */
  file_name?: string;
  /**
   * Knowledge Base Name，知识库名称
   */
  knowledge_base_name: string;
  /**
   * Metadata，根据 metadata 进行过滤，仅支持一级键
   */
  metadata?: { [key: string]: any };
  /**
   * Query，用户输入
   */
  query?: string;
  /**
   * Score Threshold，知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右
   */
  score_threshold?: number;
  /**
   * Top K，匹配向量数
   */
  top_k?: number;
}): Promise<void> {
  return chatGLMRequest({
    url: '/knowledge_base/search_docs',
    method: 'post',
    data,
  });
}

/**
 * 上传文件到知识库，并/或进行向量化
 * @returns
 */
export function uploadDocs(data: {
  files: File[];
  knowledge_base_name: string;
  override?: boolean;
  /** 上传文件后是否进行向量化 */
  to_vector_store?: boolean;
  /** 知识库中单段文本最大长度 */
  chunk_size?: number;
  /** 知识库中相邻文本重合长度 */
  chunk_overlap?: number;
  /** 是否开启中文标题加强 */
  zh_title_enhance?: boolean;
  /** 自定义的docs，需要转为json字符串 */
  docs?: string;
  /** 暂不保存向量库（用于FAISS） */
  not_refresh_vs_cache?: number;
}): Promise<void> {
  data = merge({ override: true, to_vector_store: true }, data);

  return chatGLMRequest({
    url: '/knowledge_base/upload_docs',
    method: 'post',
    data,
  });
}

/**
 * 上传文件到知识库，并/或进行向量化
 * @returns
 */
export function deleteDocs(data: {
  file_names: string[];
  knowledge_base_name: string;
  delete_content?: boolean;
  not_refresh_vs_cache?: number;
}): Promise<void> {
  data = merge({ delete_content: true }, data);

  return chatGLMRequest({
    url: '/knowledge_base/delete_docs',
    method: 'post',
    data,
  });
}

/**
 * 上传文件到知识库，并/或进行向量化
 * @returns
 */
export function updateInfo(data: { knowledge_base_name: string; kb_info: string }): Promise<void> {
  // data = merge({ delete_content: true }, data)

  return chatGLMRequest({
    url: '/knowledge_base/update_info',
    method: 'post',
    data,
  });
}

/**
 * 更新现有文件到知识库
 * @returns
 */
export function updateDocs(data: {
  file_names: string[];
  knowledge_base_name: string;
  override_custom_docs?: boolean;
  /** 知识库中单段文本最大长度 */
  chunk_size?: number;
  /** 知识库中相邻文本重合长度 */
  chunk_overlap?: number;
  /** 是否开启中文标题加强 */
  zh_title_enhance?: boolean;
  /** 自定义的docs，需要转为json字符串 */
  docs?: string;
  /** 暂不保存向量库（用于FAISS） */
  not_refresh_vs_cache?: number;
}): Promise<void> {
  // data = merge({ delete_content: true }, data)

  return chatGLMRequest({
    url: '/knowledge_base/update_docs',
    method: 'post',
    data,
  });
}

/**
 * 下载对应的知识文件
 * @returns
 */
export function downloadDoc(params: {
  file_name: string;
  knowledge_base_name: string;
  /** 是：浏览器内预览；否：下载 */
  preview?: boolean;
}): Promise<void> {
  // data = merge({ delete_content: true }, data)

  return chatGLMRequest({
    url: '/knowledge_base/download_doc',
    method: 'get',
    params,
  });
}

/**
 * 根据content中文档重建向量库，流式输出处理进度。
 * @returns
 */
export function recreateVectorStore(data: {
  /** Allow Empty Kb */
  allow_empty_kb?: boolean;
  /** 知识库中相邻文本重合长度 */
  chunk_overlap?: number;
  /** 知识库中单段文本最大长度 */
  chunk_size?: number;
  /** Embed Model */
  embed_model?: string;
  /** Knowledge Base Name */
  knowledge_base_name: string;
  /** 暂不保存向量库（用于FAISS）*/
  not_refresh_vs_cache?: boolean;
  vs_type?: string;
  /** 是否开启中文标题加强 */
  zh_title_enhance?: boolean;
}): Promise<void> {
  data = merge(
    {
      allow_empty_kb: true,
      vs_type: 'faiss',
      embed_model: 'bge-reranker-large',
      chunk_size: 250,
      chunk_overlap: 50,
      zh_title_enhance: false,
      not_refresh_vs_cache: false,
    },
    data
  );

  return chatGLMRequest({
    url: '/knowledge_base/recreate_vector_store',
    method: 'post',
    data,
  });
}

export function uploadTempDocs(data: {
  /** 上传文件，支持多文件 */
  files: File[];
  /** 前知识库ID */
  prev_id?: string;
  /** 知识库中单段文本最大长度 */
  chunk_size?: number;
  /** 知识库中相邻文本重合长度 */
  chunk_overlap?: number;
  /** 是否开启中文标题加强 */
  zh_title_enhance?: boolean;
}): Promise<{ id: string; failed_files: string[] }> {
  data.chunk_size = data.chunk_size ?? 640;
  data.chunk_overlap = data.chunk_overlap ?? 96;
  data.zh_title_enhance = data.zh_title_enhance ?? true;
  return chatGLMRequest({
    url: '/knowledge_base/upload_temp_docs',
    // url: services.chatglm + '/Chat/chat',
    method: 'post',
    data: objectToFormData(data),
  });
}

export interface SummaryCommonParams {
  /**
   * Embed Model
   */
  embed_model?: string;
  /**
   * File Description
   */
  file_description?: string;
  /**
   * Knowledge Base Name
   */
  knowledge_base_name: string;
  /**
   * Max Tokens，限制LLM生成Token数量，默认None代表模型最大值
   */
  max_tokens?: number | null;
  /**
   * Model Name，LLM 模型名称。
   */
  model_name?: string;
  /**
   * Temperature，LLM 采样温度
   */
  temperature?: number;
}
/**
 * 单个知识库根据文件名称摘要
 * @returns
 */
export function summaryFileToVectorStore(
  data: SummaryCommonParams & {
    /**
     * Allow Empty Kb
     */
    allow_empty_kb?: boolean;
    /**
     * File Name
     */
    file_name: string;
    /**
     * Knowledge Base Name
     */
    knowledge_base_name: string;
  }
): Promise<string> {
  data = merge(
    {
      allow_empty_kb: true,
      vs_type: 'faiss',
      embed_model: 'bge-reranker-large',
      temperature: 0.01,
      max_tokens: 0,
    },
    data
  );

  return chatGLMRequest({
    url:
      services.langchain_chatchat_V3 +
      '/knowledge_base/kb_summary_api/summary_file_to_vector_store',
    method: 'post',
    data,
  });
}

/**
 * 单个知识库根据doc_ids摘要
 * @returns
 */
export function summaryDocIdsToVectorStore(
  data: SummaryCommonParams & {
    /**
     * Doc Ids
     */
    doc_ids?: any[];
  }
): Promise<string> {
  data = merge(
    {
      allow_empty_kb: true,
      vs_type: 'faiss',
      embed_model: 'bge-reranker-large',
      temperature: 0.01,
      max_tokens: 0,
    },
    data
  );

  return chatGLMRequest({
    url:
      services.langchain_chatchat_V3 +
      '/knowledge_base/kb_summary_api/summary_doc_ids_to_vector_store',
    method: 'post',
    data,
  });
}

/**
 * 重建单个知识库文件摘要
 * @returns
 */
export function recreateSummaryVectorStore(
  data: SummaryCommonParams & {
    /**
     * Allow Empty Kb
     */
    allow_empty_kb?: boolean;
  }
): Promise<string> {
  data = merge(
    {
      allow_empty_kb: true,
      vs_type: 'faiss',
      embed_model: 'bge-reranker-large',
      temperature: 0.01,
      max_tokens: 0,
    },
    data
  );

  return chatGLMRequest({
    url:
      services.langchain_chatchat_V3 +
      '/knowledge_base/kb_summary_api/recreate_summary_vector_store',
    method: 'post',
    data,
  });
}
// #endregion

// #region OpenAI 兼容平台整合接口

export function openaiChat(
  options: FetchExRequestOptions<OpenAIChatParams>
): Promise<OpenAIChatResponse> {
  options.data = merge(
    {
      model: 'glm-4',
      max_tokens: 0,
      n: 0,
      presence_penalty: 0,
      temperature: 0,
      tool_choice: 'none',
    },
    options.data
  );

  return chatGLMRequest({
    ...options,
    url: '/v1/chat/completions',
    method: 'post',
  });
}

export function openaiCompletions(
  options: FetchExRequestOptions<OpenAICompletionParams>
): Promise<OpenAICompletionResponse> {
  options.data = merge(
    {
      model: defaultLLMModel,
      // max_tokens: 0,
      n: 1,
      // presence_penalty: 0,
      temperature: 0.7,
      // tool_choice: 'none',
    },
    options.data
  );

  return chatGLMRequest({
    ...options,
    returnRawData: true,
    url: '/v1/completions',
    method: 'post',
  });
}
// #endregion

export async function directRequestModel(
  options: FetchExRequestOptions<{
    model: string;
    api: string;
    data: any[];
  }>
) {
  const session_hash = uuid(3, {
    len: 11,
  });

  await chatGLMRequest({
    baseURL: 'http://192.168.14.17:9997',
    url: options.url + '/queue/join',
    method: 'post',
    data: {
      data: options.data,
      event_data: null,
      fn_index: 0,
      session_hash: session_hash,
      trigger_id: 7,
    },
  });

  await chatGLMRequest({
    url: options.url + '/queue/data',
    method: 'get',
    params: {
      session_hash: session_hash,
    },
    sse: options.sse ?? null,
  });
}
