
export default class SSEDataParser {
  static ControlChars = {
    NewLine: 10,
    CarriageReturn: 13,
    Space: 32,
    Colon: 58
  }
  /**
   *
   * @param {Uint8Array} a
   * @param {Uint8Array} b
   * @returns
   */
  static concat(a, b) {
    const res = new Uint8Array(a.length + b.length)
    res.set(a)
    res.set(b, a.length)
    return res
  }

  /** @returns {import('./sse.type').EventSourceMessage} */
  static newMessage() {
    // data, event, and id must be initialized to empty strings:
    // https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
    // retry should be initialized to undefined so we return a consistent shape
    // to the js engine all the time: https://mathiasbynens.be/notes/shapes-ics#takeaways
    return {
      data: '',
      event: '',
      id: '',
      retry: undefined
    }
  }

  /**
   * Converts a ReadableStream into a callback pattern.
   * @param {ReadableStream<Uint8Array>} stream The input ReadableStream.
   * @param {(arr: Uint8Array) => void} onChunk A function that will be called on each new byte chunk in the stream.
   * @returns {Promise<void>} A promise that will be resolved when the stream closes.
   */
  static async getBytes(stream, onChunk) {
    const reader = stream.getReader()
    /** @type {ReadableStreamDefaultReadResult<Uint8Array>} */
    let result
    while (!(result = await reader.read()).done) {
      onChunk(result.value)
    }
  }

  /**
   * Parses arbitary byte chunks into EventSource line buffers.
   * Each line should be of the format "field: value" and ends with \r, \n, or \r\n.
   * @param {(line: Uint8Array, fieldLength: number) => void} onLine A function that will be called on each new EventSource line.
   * @returns A function that should be called for each incoming byte chunk.
   */
  static getLines(onLine) {
    /** @type {Uint8Array} */
    let buffer
    /** @type {number} */
    let position // current read position
    /** @type {number} */
    let fieldLength // length of the `field` portion of the line
    let discardTrailingNewline = false

    // return a function that can process each incoming byte chunk:
    /**
     * @param {Uint8Array} arr
     */
    return function onChunk(arr) {
      if (buffer === undefined) {
        buffer = arr
        position = 0
        fieldLength = -1
      } else {
        // we're still parsing the old line. Append the new bytes into buffer:
        buffer = SSEDataParser.concat(buffer, arr)
      }

      const bufLength = buffer.length
      let lineStart = 0 // index where the current line starts
      while (position < bufLength) {
        if (discardTrailingNewline) {
          if (buffer[position] === SSEDataParser.ControlChars.NewLine) {
            lineStart = ++position // skip to next char
          }

          discardTrailingNewline = false
        }

        // start looking forward till the end of line:
        let lineEnd = -1 // index of the \r or \n char
        for (; position < bufLength && lineEnd === -1; ++position) {
          switch (buffer[position]) {
            case SSEDataParser.ControlChars.Colon:
              if (fieldLength === -1) {
                // first colon in line
                fieldLength = position - lineStart
              }
              break
            // @ts-ignore:7029 \r case below should fallthrough to \n:
            case SSEDataParser.ControlChars.CarriageReturn:
              discardTrailingNewline = true
            case SSEDataParser.ControlChars.NewLine:
              lineEnd = position
              break
          }
        }

        if (lineEnd === -1) {
          // We reached the end of the buffer but the line hasn't ended.
          // Wait for the next arr and then continue parsing:
          break
        }

        // we've reached the line end, send it out:
        onLine(buffer.subarray(lineStart, lineEnd), fieldLength)
        lineStart = position // we're now on the next line
        fieldLength = -1
      }

      if (lineStart === bufLength) {
        buffer = undefined // we've finished reading it
      } else if (lineStart !== 0) {
        // Create a new view into buffer beginning at lineStart so we don't
        // need to copy over the previous lines when we get the new arr:
        buffer = buffer.subarray(lineStart)
        position -= lineStart
      }
    }
  }

  /**
   * Parses line buffers into EventSourceMessages.
   * @param {(id: string) => void} onId A function that will be called on each `id` field.
   * @param {(retry: number) => void} onRetry A function that will be called on each `retry` field.
   * @param {(msg: import('./sse.type').EventSourceMessage) => void} [onMessage] A function that will be called on each message.
   * @returns A function that should be called for each incoming line buffer.
   */
  static getMessages(onId, onRetry, onMessage) {
    let message = SSEDataParser.newMessage()
    const decoder = new TextDecoder()

    // return a function that can process each incoming line buffer:
    /**
     * @param {Uint8Array} line
     * @param {number} fieldLength
     */
    return function onLine(line, fieldLength) {
      if (line.length === 0) {
        // empty line denotes end of message. Trigger the callback and start a new message:
        onMessage?.(message)
        message = SSEDataParser.newMessage()
      } else if (fieldLength > 0) {
        // exclude comments and lines with no values
        // line is of format "<field>:<value>" or "<field>: <value>"
        // https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
        const field = decoder.decode(line.subarray(0, fieldLength))
        const valueOffset =
          fieldLength +
          (line[fieldLength + 1] === SSEDataParser.ControlChars.Space ? 2 : 1)
        const value = decoder.decode(line.subarray(valueOffset))

        switch (field) {
          case 'data':
            // if this message already has data, append the new value to the old.
            // otherwise, just set to the new value:
            message.data = message.data ? message.data + '\n' + value : value // otherwise,
            break
          case 'event':
            message.event = value
            break
          case 'id':
            onId((message.id = value))
            break
          case 'retry':
            const retry = parseInt(value, 10)
            if (!isNaN(retry)) {
              // per spec, ignore non-integers
              onRetry((message.retry = retry))
            }
            break
        }
      }
    }
  }
}
