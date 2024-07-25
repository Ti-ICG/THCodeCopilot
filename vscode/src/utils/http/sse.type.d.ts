/**
 * Represents a message sent in an event stream
 * https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format
 */
export interface EventSourceMessage {
  /** The event ID to set the EventSource object's last event ID value. */
  id: string
  /** A string identifying the type of event described. */
  event: string
  /** The event data */
  data: string
  /** The reconnection interval (in milliseconds) to wait before retrying the connection */
  retry?: number
}

/**
 * Represents a message sent in an event stream
 * https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format
 */
export interface OpenAIMessageData {
  id: string
  choices: Array<{
    delta: {
      index: number
      finish_reason: string
      content: string
    }
  }>
}
