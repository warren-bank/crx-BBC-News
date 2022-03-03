// ==UserScript==
// @name         BBC News
// @description  Watch live video stream in external player.
// @version      0.0.1
// @match        *://bbc.com/news/live/*
// @match        *://*.bbc.com/news/live/*
// @icon         https://m.files.bbci.co.uk/modules/bbc-morph-news-waf-page-meta/5.2.0/apple-touch-icon.png
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-BBC-News/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-BBC-News/issues
// @downloadURL  https://github.com/warren-bank/crx-BBC-News/raw/webmonkey-userscript/es5/webmonkey-userscript/BBC-News.user.js
// @updateURL    https://github.com/warren-bank/crx-BBC-News/raw/webmonkey-userscript/es5/webmonkey-userscript/BBC-News.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

// ----------------------------------------------------------------------------- helpers (xhr)

var serialize_xhr_body_object = function(data) {
  if (typeof data === 'string')
    return data

  if (!(data instanceof Object))
    return null

  var body = []
  var keys = Object.keys(data)
  var key, val
  for (var i=0; i < keys.length; i++) {
    key = keys[i]
    val = data[key]
    val = unsafeWindow.encodeURIComponent(val)

    body.push(key + '=' + val)
  }
  body = body.join('&')
  return body
}

var download_text = function(url, headers, data, callback) {
  if (data) {
    if (!headers)
      headers = {}
    if (!headers['content-type'])
      headers['content-type'] = 'application/x-www-form-urlencoded'

    switch(headers['content-type'].toLowerCase()) {
      case 'application/json':
        data = JSON.stringify(data)
        break

      case 'application/x-www-form-urlencoded':
      default:
        data = serialize_xhr_body_object(data)
        break
    }
  }

  var xhr    = new unsafeWindow.XMLHttpRequest()
  var method = data ? 'POST' : 'GET'

  xhr.open(method, url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(xhr.responseText)
      }
    }
  }

  if (data)
    xhr.send(data)
  else
    xhr.send()
}

var download_json = function(url, headers, data, callback) {
  if (!headers)
    headers = {}
  if (!headers.accept)
    headers.accept = 'application/json'

  download_text(url, headers, data, function(text){
    try {
      callback(JSON.parse(text))
    }
    catch(e) {}
  })
}

// -----------------------------------------------------------------------------

var download_video_url = function(video_id, callback) {
  var url, headers, data, xhr_callback

  url     = 'https://open.live.bbc.co.uk/mediaselector/6/select/version/2.0/mediaset/pc/vpid/' + video_id + '/format/json'
  headers = null
  data    = null

  xhr_callback = function(json) {
    var media, connection

    var video_types = {
      "hls":  "application/x-mpegurl",
      "dash": "application/dash+xml"
    }

    if ((json instanceof Object) && Array.isArray(json.media) && json.media.length) {
      for (var i1=0; i1 < json.media.length; i1++) {
        media = json.media[i1]

        if ((media instanceof Object) && Array.isArray(media.connection) && media.connection.length) {
          for (var i2=0; i2 < media.connection.length; i2++) {
            connection = media.connection[i2]

            if ((connection instanceof Object) && connection.href && connection.transferFormat && video_types[connection.transferFormat]) {
              callback({
                video_url:  connection.href,
                video_type: video_types[connection.transferFormat]
              })
            }
          }
        }
      }
    }
  }

  download_json(url, headers, data, xhr_callback)
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, caption_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_caption_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_caption_url   = caption_url ? encodeURIComponent(encodeURIComponent(btoa(caption_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_caption_url ? ('/subtitle/' + encoded_caption_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_data = function(data) {
  if (!data.video_url) return

  if (!data.referer_url)
    data.referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ data.video_url,
      /* type   = */ data.video_type
    ]

    // extras:
    if (data.caption_url) {
      args.push('textUrl')
      args.push(data.caption_url)
    }
    if (data.referer_url) {
      args.push('referUrl')
      args.push(data.referer_url)
    }
    if (data.drm instanceof Object) {
      if (data.drm.scheme) {
        args.push('drmScheme')
        args.push(data.drm.scheme)
      }
      if (data.drm.server) {
        args.push('drmUrl')
        args.push(data.drm.server)
      }
      if (data.drm.headers instanceof Object) {
        var drm_header_keys, drm_header_key, drm_header_val

        drm_header_keys = Object.keys(data.drm.headers)
        for (var i=0; i < drm_header_keys.length; i++) {
          drm_header_key = drm_header_keys[i]
          drm_header_val = data.drm.headers[drm_header_key]

          args.push('drmHeader')
          args.push(drm_header_key + ': ' + drm_header_val)
        }
      }
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(data.video_url, data.caption_url, data.referer_url))
    return true
  }
  else {
    return false
  }
}

// ------------------------------------- helpers (unused)

var process_hls_data = function(data) {
  data.video_type = 'application/x-mpegurl'
  process_video_data(data)
}

var process_dash_data = function(data) {
  data.video_type = 'application/dash+xml'
  process_video_data(data)
}

// ------------------------------------- helpers (unused)

var process_video_url = function(video_url, video_type, caption_url, referer_url) {
  var data = {
    drm: {
      scheme:    null,
      server:    null,
      headers:   null
    },
    video_url:   video_url   || null,
    video_type:  video_type  || null,
    caption_url: caption_url || null,
    referer_url: referer_url || null
  }

  process_video_data(data)
}

var process_hls_url = function(video_url, caption_url, referer_url) {
  process_video_url(video_url, /* video_type= */ 'application/x-mpegurl', caption_url, referer_url)
}

var process_dash_url = function(video_url, caption_url, referer_url) {
  process_video_url(video_url, /* video_type= */ 'application/dash+xml', caption_url, referer_url)
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  var video_id = extract_video_id()
  if (!video_id) return

  process_video(video_id)
}

// ----------------------------------------------------------------------------- data extractor

var extract_video_id = function() {
  var scripts, script, index_start, index_stop

  var video_id = null

  var substrings = {
    prefix: 'Morph.toInit.payloads.push(',
    start:  '"leadMedia":',
    stop:   '"supportingMedia":'
  }

  var regex = /^.*?"(?:vpid|playablePid)"\s*:\s*"([^"]+)".*$/

  try {
    scripts = unsafeWindow.document.querySelectorAll('script:not([src])')
    for (var i=0; i < scripts.length; i++) {
      script = scripts[i]
      script = script.innerText.trim()

      if (!script) continue
      if (script.indexOf(substrings.prefix) !== 0) continue

      index_start = script.indexOf(substrings.start)
      index_stop  = script.indexOf(substrings.stop)

      if (index_start === -1) continue
      if (index_stop  === -1) continue
      if (index_start >= index_stop) continue

      script = script.substring(index_start, index_stop)
      script = script.replace(/[\r\n\t]+/g, ' ')

      if (!regex.test(script)) continue

      video_id = script.replace(regex, '$1')
      break
    }
  }
  catch(e) {}

  return video_id
}

// ----------------------------------------------------------------------------- process video

var process_video = function(video_id, callback) {
  if (!callback)
    callback = process_video_data

  download_video_url(video_id, callback)
}

// -----------------------------------------------------------------------------

init()
