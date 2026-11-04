// 브라우저 전용: geotiff.js 로 COG 범위 요청 창 읽기, 참색 영상(visual) 창을 그림 주소(Blob)로 만든다
import { fromUrl } from 'geotiff'
import { runAnalysis } from './analyze.js'
import { runRepro } from './repro.js'

const cache = new Map()
export function openTiff(href) {
  if (!cache.has(href)) cache.set(href, fromUrl(href, { allowFullFile: false }).catch((e) => { cache.delete(href); throw e }))
  return cache.get(href)
}

async function makeImage(scene, box) {
  const asset = scene.assets.visual
  if (!asset) return null
  const tiff = await openTiff(asset.href)
  const image = await tiff.getImage(0)
  const [ox, oy] = image.getOrigin()
  const [rx, ry] = image.getResolution()
  const win = [Math.round((box.xmin - ox) / rx), Math.round((box.ymax - oy) / ry), Math.round((box.xmax - ox) / rx), Math.round((box.ymin - oy) / ry)]
  const rgb = await image.readRasters({ window: win, interleave: true, fillValue: 0 })
  const w = win[2] - win[0]
  const h = win[3] - win[1]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  const bands = rgb.length / (w * h)
  for (let i = 0; i < w * h; i += 1) {
    img.data[i * 4] = rgb[i * bands]
    img.data[i * 4 + 1] = rgb[i * bands + 1]
    img.data[i * 4 + 2] = rgb[i * bands + 2]
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  return blob ? { url: URL.createObjectURL(blob), date: scene.date, id: scene.id, bounds: box } : null
}

// 분석 중 받은 바이트 수를 세려고 fetch 를 잠시 감싼다(응답 content-length 합)
async function counted(fn) {
  const orig = window.fetch
  const c = { bytes: 0, requests: 0 }
  window.fetch = async (...a) => {
    const res = await orig(...a)
    c.requests += 1
    c.bytes += Number(res.headers.get('content-length') || 0)
    return res
  }
  try {
    const out = await fn(orig)
    return { out, ...c }
  } finally {
    window.fetch = orig
  }
}

export async function analyzeInBrowser(params, { onProgress, signal } = {}) {
  const { out, bytes, requests } = await counted((orig) => runAnalysis(params, { openTiff, makeImage, fetchFn: orig, onProgress, signal }))
  out.meta.bytes = bytes
  out.meta.requests = requests
  return out
}

// 재현 기준. cfg: { aoi, zone, south, halfM, periods, features }
export async function reproInBrowser(cfg, { onProgress, signal } = {}) {
  const { out, bytes, requests } = await counted((orig) => runRepro(cfg, { openTiff, fetchFn: orig, onProgress, signal }))
  return { ...out, bytes, requests }
}
