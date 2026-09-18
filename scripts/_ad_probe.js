/**
 * 广告链路运行时探针（通过 _cdp.js --file 注入到壳内 H5 页面）
 * 观察点：
 *   1. [CALL] 桥接侧所有 ad.* 调用及其参数（确认 H5 组件是否真的发起请求）
 *   2. [EMIT] 原生回传事件（广告回调路由情况）
 *   3. [IO]   IntersectionObserver 构造/observe/触发（广告组件可见性判断）
 *   4. [GCP]  全局 getCurrentPages 调用（壳内该全局原本不存在）
 */
(function () {
  if (window.__adProbeInstalled) return 'already installed'
  window.__adProbeInstalled = true

  // 1) 桥接调用日志：所有 ad.* 调用及其参数
  var NB = window.NativeBridge
  if (NB && typeof NB.call === 'function') {
    var origCall = NB.call.bind(NB)
    NB.call = function (m, p, id) {
      try {
        if (String(m).indexOf('ad.') === 0) console.log('[CALL]', m, '|', String(p).slice(0, 300))
      } catch (e) {}
      return origCall(m, p, id)
    }
  }

  // 2) 原生事件回传日志
  var origEmit = window.__nativeEmit
  window.__nativeEmit = function (name, data) {
    try {
      console.log('[EMIT]', name, '|', String(data).slice(0, 200))
    } catch (e) {}
    if (typeof origEmit === 'function') return origEmit(name, data)
  }

  // 3) IntersectionObserver 探针
  if (window.IntersectionObserver) {
    var IO = window.IntersectionObserver
    var Wrapped = function (cb, opts) {
      console.log('[IO] constructed')
      var wrapped = function (entries) {
        try {
          var e = entries && entries[0]
          console.log('[IO] tick intersecting=', e && e.isIntersecting, 'cls=', e && e.target && e.target.className)
        } catch (err) {}
        return cb(entries)
      }
      var inst = new IO(wrapped, opts)
      var obs = inst.observe.bind(inst)
      inst.observe = function (t) {
        console.log('[IO] observe cls=', t && t.className)
        return obs(t)
      }
      return inst
    }
    Wrapped.prototype = IO.prototype
    window.IntersectionObserver = Wrapped
  }

  // 4) 全局 getCurrentPages 探针（壳内该全局原本不存在）
  try {
    if (typeof window.getCurrentPages === 'undefined') {
      window.getCurrentPages = function () {
        console.log('[GCP] global getCurrentPages called')
        return []
      }
    }
  } catch (e) {}

  return 'ad probe installed'
})()
