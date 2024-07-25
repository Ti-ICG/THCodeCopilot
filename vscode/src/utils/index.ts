import { isInteger } from 'lodash-es'

export function objectToFormData(data: Record<string, any>) {
  const formdata = new FormData()
  Object.keys(data).forEach((key) => {
    let value = data[key]
    if (Array.isArray(value)) {
      value.forEach((item) => {
        formdata.append(key, item)
      })
    } else if (value != null && value !== '') {
      formdata.append(key, data[key])
    }
  })
  return formdata
}

export function arrToObject(arr: any[], propKey: string, valueKey: string) {
  const obj: Record<string, any> = {}
  arr?.forEach((item) => {
    if (item[propKey]) {
      obj[item[propKey]] = item[valueKey]
    }
  })
  return obj
}

/**
 * 解析数字单位
 * @param num
 * @param options
 * @returns
 */
export function parseNumberUnit(
  num: number,
  options: {
    /** 是否为字节数 */
    binary?: boolean
    /** 小数位数 */
    decimalPlace?: number
  } = { decimalPlace: 2 }
) {
  if (num == null) {
    return ''
  } else if (num === 0) {
    return '0'
  }

  const base = options.binary ? 1024 : 1000
  const units = ' KMGTPE'

  let b = num
  let unitCount = 0
  let maxUnitCount = units.length - 1
  while (b > base) {
    if (unitCount >= maxUnitCount) {
      break
    }
    b = b / base
    unitCount++
  }

  return `${isInteger(b) ? b : b.toFixed(options.decimalPlace ?? 2)} ${
    units[unitCount] || ''
  }${options.binary ? 'B' : ''}`
}

export function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function parseFileSize(size: number) {
  if (!size) {
    return ''
  }

  return parseNumberUnit(size, { binary: true })
  // const b = size / 1024
  // if (b < 1024.0) {
  //   return b.toFixed(2) + ' KB'
  // } else if (b < 1048576.0) {
  //   return (b / 1024).toFixed(2) + ' MB'
  // } else if (b < 1073741824.0) {
  //   return (b / 1048576).toFixed(2) + ' GB'
  // } else {
  //   return (b / 1073741824).toFixed(2) + ' TB'
  // }
}

export function batchExecAsyncFuncs(
  asyncFuncs: Array<() => Promise<any>>,
  maxConcurrency: number = 10
) {
  /** 正在执行的数量 */
  let execCount = 0
  let results: Array<any> = []
  let index = 0
  return new Promise<Array<any>>((resolve, reject) => {
    // 定义一个执行函数，用于从异步函数数组中取出一个异步函数并执行
    function execute() {
      // 如果索引超过了异步函数数组的长度，说明所有异步函数都已经取出
      if (index >= asyncFuncs.length) {
        // 如果计数器为0，说明所有异步函数都已经执行完成
        if (execCount === 0) {
          // 用结果数组来解决返回的promise
          resolve(results)
        }
        // 直接返回，不再执行后续的逻辑
        return
      }
      // 从异步函数数组中取出一个异步函数
      let asyncFunc = asyncFuncs[index]
      // 索引自增，指向下一个异步函数
      index++
      // 计数器自增，表示当前正在执行的异步函数的数量增加了一个
      execCount++
      // 执行异步函数，并传入一个成功回调和一个失败回调
      asyncFunc()
        .then((value) => {
          // 将成功的返回值按照顺序存入结果数组
          results[index - 1] = value
          // 计数器自减，表示当前正在执行的异步函数的数量减少了一个
          execCount--
          // 递归调用执行函数，继续执行下一个异步函数
          execute()
        })
        .catch((reason) => {
          // 如果异步函数执行失败，直接用失败的原因来拒绝返回的promise
          reject(reason)
        })
    }
    // 根据最大并发数max，循环调用执行函数，启动max个异步函数的执行
    for (let i = 0; i < maxConcurrency; i++) {
      execute()
    }
  })
}

/**
 * 指向js代码字符串
 * @param this 上下文
 * @param code js代码字符串
 * @param args 传入的参数
 * @returns
 */
export function execJS<T>(this: any, code: string, ...args: any[]): T {
  const fn = new Function(code)

  return fn.apply(this, args)
}

export function getQueryParams(search: string) {
  return searchParamsToObj(new URLSearchParams(search))
}

export function searchParamsToObj(uRLSearchParams: URLSearchParams) {
  const result: Record<string, any> = {}

  for (let key of uRLSearchParams.keys()) {
    result[key] = uRLSearchParams.get(key)
  }
  return result
}

// export { default as uuid } from './uuid.ts'
