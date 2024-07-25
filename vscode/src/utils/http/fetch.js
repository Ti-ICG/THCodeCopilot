import SSEDataParser from './SSEDataParser';

export const EventStreamContentType = 'text/event-stream';

const DefaultRetryInterval = 1000;
const LastEventId = 'last-event-id';

function guid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 *
 * @param {string} url
 * @param {import("./fetch.type").FetchExRequestOptions} options
 * @returns {import('./fetch.type').CancellablePromise<Response>}
 */
export function fetchEx(url, options) {
  let curRequestController = new AbortController();

  /** @type {import('./fetch.type').CancellablePromise<Response} */
  const result = new Promise(async (resolve, reject) => {
    options.timeout = options.timeout ?? 30000;
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
            if (typeof options.headers?.delete === 'function') {
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
      default:
        options.headers = Object.assign(options.headers || {}, {
          'Content-Type': 'application/json',
        });
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

    let timeoutTimer;

    if (options.sse) {
      options.headers['Accept'] = EventStreamContentType;
      options.sse.messageType = options.sse.messageType || 'PlainText';
      // function onVisibilityChange() {
      //   curRequestController.abort() // close existing request on every visibility change
      //   if (!document.hidden) {
      //     create() // page is now visible again, recreate request.
      //   }
      // }
      // if (!options.sse.openWhenHidden) {
      //   document.addEventListener('visibilitychange', onVisibilityChange)
      // }

      let retryInterval = DefaultRetryInterval;
      let retryTimer = 0;

      function dispose() {
        // document.removeEventListener('visibilitychange', onVisibilityChange)
        // window.clearTimeout(retryTimer)
      }

      // if the incoming signal aborts, dispose resources and resolve:
      options.signal?.addEventListener('abort', () => {
        curRequestController.abort(options.signal.reason);
        dispose();
        // reject('abort') // don't waste time constructing/logging errors
      });

      const { onmessage, onclose, onerror, onopen } = options.sse;
      async function create() {
        try {
          if (options.timeout != null && options.timeout !== 0) {
            timeoutTimer = setTimeout(() => {
              curRequestController.abort(`timeout of ${options.timeout}ms`);
            }, options.timeout);
          }

          const response = await fetch(url, {
            ...options,
            signal: curRequestController.signal,
          });
          timeoutTimer && clearTimeout(timeoutTimer);

          if (response.status !== 200) {
            // 报错
            return reject(`Server responded with ${response.status}`);
          }

          if (response.headers['Content-Type']?.includes(EventStreamContentType)) {
            return reject(
              `接口响应有误，Content-Type应为${EventStreamContentType},实际为${response.headers['Content-Type']}`
            );
          }

          await onopen?.(response);

          if (options.sse.decoder) {
          } else if (options.sse.messageType === 'SSE') {
            await SSEDataParser.getBytes(
              response.body,
              SSEDataParser.getLines(
                SSEDataParser.getMessages(
                  (id) => {
                    if (id) {
                      // store the id and send it back on the next retry:
                      options.headers[LastEventId] = id;
                    } else {
                      // don't send the last-event-id header anymore:
                      delete options.headers[LastEventId];
                    }
                  },
                  (retry) => {
                    retryInterval = retry;
                  },
                  onmessage
                  // (msg) => {
                  //   onmessage?.(msg)
                  //   if (msg.data === '[DONE]') {
                  //     return onfinish?.(responseText)
                  //   }
                  //   const text = msg.data
                  //   if (!text) return

                  //   try {
                  //     const json = JSON.parse(text)
                  //     const content = json.choices[0].delta.content
                  //     if (content) {
                  //       responseText += content
                  //       onupdate?.(responseText, content)
                  //     }
                  //   } catch (e) {
                  //     console.error('[Request] parse error', text, msg)
                  //   }
                  // }
                )
              )
            );
          } else if (options.sse.messageType === 'PlainText') {
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf8');
            /**
             * @type {ReadableStreamReadResult<Uint8Array>}
             */
            let result;
            // buffer = ''
            while (!(result = await reader.read()).done) {
              if (!result.value) {
                continue;
              }
              /** @type {string} */
              const msg = decoder.decode(result.value, {
                stream: !result.done,
              });

              // console.log(msg)
              if (msg) {
                onmessage(msg);
                // buffer += msg
              }
            }
            reader.releaseLock();
          }

          onclose?.();
          dispose();

          resolve(response);
        } catch (error) {
          timeoutTimer && clearTimeout(timeoutTimer);
          if (curRequestController.signal.aborted) {
            return reject(
              curRequestController.signal.reason
                ? new Error(curRequestController.signal.reason)
                : error
            );
          } else {
            onerror?.(error);
            reject(error);
            // if we haven't aborted the request ourselves:
            try {
              // check if we need to retry:
              // const interval = onerror?.(error) ?? retryInterval
              // globalThis.clearTimeout(retryTimer)
              // retryTimer = globalThis.setTimeout(create, interval)
            } catch (innerErr) {
              // we should not retry anymore:
              dispose();
              reject(innerErr);
            }
          }
        }
      }

      return create();
    } else {
      // if the incoming signal aborts, dispose resources and resolve:
      options.signal?.addEventListener('abort', (ev) => {
        curRequestController.abort(options.signal.reason);
      });
      if (options.timeout != null && options.timeout !== 0) {
        timeoutTimer = setTimeout(() => {
          // curRequestController.abort(`timeout of ${options.timeout}ms`)
          curRequestController.abort(`timeout of ${options.timeout}ms`);
        }, options.timeout);
      }
      try {
        const response = await fetch(url, {
          ...options,
          signal: curRequestController.signal,
        });

        timeoutTimer && clearTimeout(timeoutTimer);
        if (options.autoParse) {
          let messageType = (
            response.headers.get('ContentType') ||
            response.headers.get('Content-Type') ||
            response.headers.get('content-type')
          ).toLocaleLowerCase();

          switch (messageType) {
            case 'application/json':
              return resolve(await response.json());
          }
        }
        resolve(response);
      } catch (error) {
        if (curRequestController?.signal.aborted) {
          return reject(
            curRequestController.signal.reason
              ? new Error(curRequestController.signal.reason)
              : error
          );
        }
        reject(error);
      }
    }
  });
  result.cancel = function cancel(reason = 'Cancel') {
    curRequestController.abort(new Error(reason));
  };
  return result;
}
