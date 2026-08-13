/* eslint-disable @typescript-eslint/explicit-function-return-type */
;(function (global) {
  'use strict'

  var baseUrl = 'http://127.0.0.1:17653'

  function request(path, options) {
    var controller = new AbortController()
    var timeout = setTimeout(function () {
      controller.abort()
    }, 35000)

    return fetch(baseUrl + path, Object.assign({}, options || {}, { signal: controller.signal }))
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            throw new Error(data.error || 'mprint 请求失败')
          }
          return data
        })
      })
      .catch(function (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('连接 mprint 超时，请确认程序已经启动。')
        }
        if (error instanceof TypeError) {
          throw new Error('无法连接 mprint，请确认程序已经启动并允许网页访问本地网络。')
        }
        throw error
      })
      .finally(function () {
        clearTimeout(timeout)
      })
  }

  function post(path, data) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  }

  global.MPrint = Object.freeze({
    configure: function (options) {
      if (options && options.baseUrl) {
        baseUrl = String(options.baseUrl).replace(/\/$/, '')
      } else if (options && options.port) {
        baseUrl = 'http://127.0.0.1:' + Number(options.port)
      }
      return this
    },
    health: function () {
      return request('/v1/health')
    },
    getPrinters: function () {
      return request('/v1/printers')
    },
    print: function (printRequest) {
      return post('/v1/print', printRequest)
    },
    preview: function (printRequest) {
      return post('/v1/preview', printRequest)
    },
    cacheFont: function (font, options) {
      return post('/v1/fonts/cache', {
        font: font,
        refresh: Boolean(options && options.refresh)
      })
    },
    removeCachedFont: function (font) {
      return post('/v1/fonts/cache/remove', { font: font })
    },
    clearFontCache: function () {
      return post('/v1/fonts/cache/clear', {})
    }
  })
})(typeof window !== 'undefined' ? window : globalThis)
