// #region openai
/**
 * OpenAIChatInput
 */
export interface OpenAIChatParams {
  /**
   * Extra Body
   */
  extra_body?: { [key: string]: any } | null;
  /**
   * Extra Headers
   */
  extra_headers?: { [key: string]: any } | null;
  /**
   * Extra Query
   */
  extra_query?: { [key: string]: any } | null;
  /**
   * Frequency Penalty
   */
  frequency_penalty?: number | null;
  /**
   * Function Call
   */
  function_call?: FunctionCallEnum | null | ChatCompletionFunctionCallOptionParam;
  /**
   * Functions
   */
  functions?: OpenaiTypesChatCompletionCreateParamsFunction[];
  /**
   * Logit Bias
   */
  logit_bias?: { [key: string]: number } | null;
  /**
   * Logprobs
   */
  logprobs?: boolean | null;
  /**
   * Max Tokens
   */
  max_tokens?: number | null;
  /**
   * Messages
   */
  messages: Message[];
  /**
   * Model
   */
  model?: string;
  /**
   * N
   */
  n?: number | null;
  /**
   * Presence Penalty
   */
  presence_penalty?: number | null;
  response_format?: ResponseFormat;
  /**
   * Seed
   */
  seed?: number | null;
  /**
   * Stop
   */
  stop?: string[] | null | string;
  /**
   * Stream
   */
  stream?: boolean | null;
  /**
   * Temperature
   */
  temperature?: number | null;
  /**
   * Timeout
   */
  timeout?: number | null;
  /**
   * Tool Choice
   */
  tool_choice?: null | ChatCompletionNamedToolChoiceParam | string;
  /**
   * Tools
   */
  tools?: Array<ChatCompletionToolParam | string>;
  /**
   * Top Logprobs
   */
  top_logprobs?: number | null;
  /**
   * Top P
   */
  top_p?: number | null;
  /**
   * User
   */
  user?: null | string;
  [property: string]: any;
}

export interface OpenAICompletionParams {
  /**
   * 默认为1 在服务器端生成best_of个补全,并返回“最佳”补全(每个令牌的日志概率最高的那个)。无法流式传输结果。
   * 与n一起使用时,best_of控制候选补全的数量,n指定要返回的数量 – best_of必须大于n。
   * 注意:因为这个参数会生成许多补全,所以它可以快速消耗您的令牌配额。请谨慎使用,并确保您对max_tokens和stop有合理的设置。
   */
  best_of?: number;
  /**
   * 默认为false 除了补全之外,还回显提示
   */
  echo?: boolean;
  /**
   * 默认为0 -2.0和2.0之间的数字。正值根据文本目前的现有频率处罚新令牌,降低模型逐字重复相同行的可能性。
   */
  frequency_penalty?: number;
  /**
   * 默认为null 修改完成中指定令牌出现的可能性。
   * 接受一个JSON对象,该对象将令牌(由GPT令牌化器中的令牌ID指定)映射到关联偏差值,-100到100。您可以使用这个令牌化器工具(适用于GPT-2和GPT-3)将文本转换为令牌ID。从数学上讲,偏差在对模型进行采样之前添加到生成的logit中。确切效果因模型而异,但-1至1之间的值应降低或提高选择的可能性;像-100或100这样的值应导致相关令牌的禁用或专属选择。
   * 例如,您可以传递{"50256": -100}来防止生成<|endoftext|>令牌。
   */
  logit_bias?: { [key: string]: any };
  /**
   * 默认为null
   * 包括logprobs个最可能令牌的日志概率,以及所选令牌。例如,如果logprobs为5,API将返回5个最有可能令牌的列表。
   * API总会返回采样令牌的logprob,因此响应中最多可能有logprobs+1个元素。
   *
   * logprobs的最大值是5。
   */
  logprobs?: null;
  /**
   * 默认为16
   * 在补全中生成的最大令牌数。
   *
   * 提示的令牌计数加上max_tokens不能超过模型的上下文长度。 计数令牌的Python代码示例。
   */
  max_tokens?: number;
  /**
   * 要使用的模型的 ID。您可以使用[List models](https://platform.openai.com/docs/api-reference/models/list)
   * API 来查看所有可用模型，或查看我们的[模型概述](https://platform.openai.com/docs/models/overview)以了解它们的描述。
   */
  model: string;
  /**
   * 默认为1
   * 为每个提示生成的补全数量。
   *
   * 注意:因为这个参数会生成许多补全,所以它可以快速消耗您的令牌配额。请谨慎使用,并确保您对max_tokens和stop有合理的设置。
   */
  n?: number;
  /**
   * 默认为0 -2.0和2.0之间的数字。正值根据它们是否出现在目前的文本中来惩罚新令牌,增加模型讨论新话题的可能性。  有关频率和存在惩罚的更多信息,请参阅。
   */
  presence_penalty?: number;
  /**
   * 生成完成的提示，编码为字符串、字符串数组、标记数组或标记数组数组。  请注意，<|endoftext|>
   * 是模型在训练期间看到的文档分隔符，因此如果未指定提示，模型将生成新文档的开头。
   */
  prompt: string;
  /**
   * 如果指定,我们的系统将尽最大努力确定性地进行采样,以便使用相同的种子和参数的重复请求应返回相同的结果。
   * 不保证确定性,您应该参考system_fingerprint响应参数来监视后端的更改。
   */
  seed?: number;
  /**
   * 默认为null 最多4个序列,API将停止在其中生成更多令牌。返回的文本不会包含停止序列。
   */
  stop?: string;
  /**
   * 默认为false 是否流回部分进度。如果设置,令牌将作为可用时发送为仅数据的服务器发送事件,流由数据 Terminated by a data: [DONE] message.
   * 对象消息终止。 Python代码示例。
   */
  stream?: boolean;
  /**
   * 默认为null 在插入文本的补全之后出现的后缀。
   */
  suffix?: string;
  /**
   * 默认为1 要使用的采样温度,介于0和2之间。更高的值(如0.8)将使输出更随机,而更低的值(如0.2)将使其更集中和确定。  我们通常建议更改这个或top_p,而不是两者都更改。
   */
  temperature?: number;
  /**
   * 表示最终用户的唯一标识符,这可以帮助OpenAI监控和检测滥用。 了解更多。
   */
  top_p?: number;
  user?: string;
  [property: string]: any;
}

export interface Choice {
  finish_reason?: string;
  index?: number;
  message?: Message;
  [property: string]: any;
}

export interface Usage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  [property: string]: any;
}

export interface OpenAIChatResponse {
  choices: Choice[];
  created: number;
  id: string;
  object: string;
  usage: Usage;
  [property: string]: any;
}

export interface OpenAICompletionResponse {
  choices: Choice[];
  created: number;
  id: string;
  model: string;
  object: string;
  system_fingerprint: string;
  usage: Usage;
  [property: string]: any;
}

export type FunctionCallEnum = 'none' | 'auto';

/**
 * ChatCompletionFunctionCallOptionParam
 */
export interface ChatCompletionFunctionCallOptionParam {
  /**
   * Name
   */
  name: string;
  [property: string]: any;
}

/**
 * Function
 */
export interface OpenaiTypesChatCompletionCreateParamsFunction {
  /**
   * Description
   */
  description?: string;
  /**
   * Name
   */
  name: string;
  /**
   * Parameters
   */
  parameters?: { [key: string]: any };
  [property: string]: any;
}

/**
 * ChatCompletionSystemMessageParam
 *
 * ChatCompletionUserMessageParam
 *
 * ChatCompletionAssistantMessageParam
 *
 * ChatCompletionToolMessageParam
 *
 * ChatCompletionFunctionMessageParam
 */
export interface Message {
  /**
   * Content
   */
  content?: ChatCompletionContentPartParam[] | null | string;
  /**
   * Name
   */
  name?: string;
  /**
   * Role
   */
  role: keyof Role;
  function_call?: null | FunctionCall;
  /**
   * Tool Calls
   */
  tool_calls?: ChatCompletionMessageToolCallParam[];
  /**
   * Tool Call Id
   */
  tool_call_id?: string;
  [property: string]: any;
}

/**
 * ChatCompletionContentPartTextParam
 *
 * ChatCompletionContentPartImageParam
 */
export interface ChatCompletionContentPartParam {
  /**
   * Text
   */
  text?: string;
  /**
   * Type
   */
  type: ContentType;
  image_url?: ImageURL;
  [property: string]: any;
}

/**
 * ImageURL
 */
export interface ImageURL {
  /**
   * Detail
   */
  detail?: Detail;
  /**
   * Url
   */
  url: string;
  [property: string]: any;
}

/**
 * Detail
 */
export enum Detail {
  Auto = 'auto',
  High = 'high',
  Low = 'low',
}

export enum ContentType {
  Imageurl = 'image_url',
  Text = 'text',
}

/**
 * FunctionCall
 */
export interface FunctionCall {
  /**
   * Arguments
   */
  arguments: string;
  /**
   * Name
   */
  name: string;
  [property: string]: any;
}

export interface Role {
  assistant;
  function;
  system;
  tool;
  user;
}

/**
 * ChatCompletionMessageToolCallParam
 */
export interface ChatCompletionMessageToolCallParam {
  function: OpenaiTypesChatChatCompletionMessageToolCallParamFunction;
  /**
   * Id
   */
  id: string;
  /**
   * Type
   */
  type: ToolCallType;
  [property: string]: any;
}

/**
 * Function
 */
export interface OpenaiTypesChatChatCompletionMessageToolCallParamFunction {
  /**
   * Arguments
   */
  arguments: string;
  /**
   * Name
   */
  name: string;
  [property: string]: any;
}

export enum ToolCallType {
  Function = 'function',
}

/**
 * ResponseFormat
 */
export interface ResponseFormat {
  /**
   * Type
   */
  type?: ResponseFormatType;
  [property: string]: any;
}

/**
 * Type
 */
export enum ResponseFormatType {
  JsonObject = 'json_object',
  Text = 'text',
}

/**
 * ChatCompletionNamedToolChoiceParam
 */
export interface ChatCompletionNamedToolChoiceParam {
  function: OpenaiTypesChatChatCompletionNamedToolChoiceParamFunction;
  /**
   * Type
   */
  type: ToolCallType;
  [property: string]: any;
}

/**
 * Function
 */
export interface OpenaiTypesChatChatCompletionNamedToolChoiceParamFunction {
  /**
   * Name
   */
  name: string;
  [property: string]: any;
}

/**
 * ChatCompletionToolParam
 */
export interface ChatCompletionToolParam {
  function: FunctionDefinition;
  /**
   * Type
   */
  type: ToolCallType;
  [property: string]: any;
}

/**
 * FunctionDefinition
 */
export interface FunctionDefinition {
  /**
   * Description
   */
  description?: string;
  /**
   * Name
   */
  name: string;
  /**
   * Parameters
   */
  parameters?: { [key: string]: any };
  [property: string]: any;
}

// #endregion
