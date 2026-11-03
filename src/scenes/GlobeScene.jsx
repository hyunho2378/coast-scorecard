// 장면 1. 순수 three.js 지구본. 위성 궤도는 satellite.js 로 계산하고, 궤도 요소는 미리 받아 둔 정적 OMM 파일을 쓴다
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js'
import { readPalette } from '../lib/palette.js'
import { useModeTick } from '../shell/screenMode.js'
import { Box, PageHead } from '../ui/index.jsx'

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
let PAL = {}

const R_KM = 6371
const SPEED = 120 // 모의 시계 배속

function toVec(lat, lon, r = 1) {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

function earthTexture(land) {
  const W = 2048, H = 1024
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.fillStyle = PAL.ocean
  g.fillRect(0, 0, W, H)
  g.strokeStyle = PAL.graticule
  g.lineWidth = 1
  for (let lon = -180; lon <= 180; lon += 30) { const x = (lon + 180) / 360 * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
  for (let lat = -60; lat <= 60; lat += 30) { const y = (90 - lat) / 180 * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
  g.fillStyle = PAL.land
  const ring = (pts) => pts.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; i ? g.lineTo(x, y) : g.moveTo(x, y) })
  for (const f of land.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys) { g.beginPath(); poly.forEach(ring); g.closePath(); g.fill('evenodd') }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function satPoint(rec, date) {
  const pv = propagate(rec, date)
  if (!pv || !pv.position) return null
  const gd = eciToGeodetic(pv.position, gstime(date))
  return toVec(degreesLat(gd.latitude), degreesLong(gd.longitude), 1 + gd.height / R_KM)
}

export default function GlobeScene({ sites, omm, onPick }) {
  const tick = useModeTick()
  const host = useRef(null)
  const pinRefs = useRef({})
  const api = useRef(null)
  const [simTime, setSimTime] = useState(() => new Date())
  const [flying, setFlying] = useState(null)

  useEffect(() => {
    PAL = readPalette()
    const el = host.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100)
    camera.position.copy(toVec(25, 65, 3.6))
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 1.3
    controls.maxDistance = 6
    scene.add(new THREE.AmbientLight(0xffffff, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(4, 2, 3)
    scene.add(sun)

    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 6 }))
    scene.add(earth)
    let alive = true
    fetch('/data/ne_110m_land.geojson').then((r) => r.json()).then((land) => {
      if (!alive) return
      earth.material.map = earthTexture(land)
      earth.material.needsUpdate = true
    })

    // 사업지 핀
    const pinGeo = new THREE.SphereGeometry(0.012, 16, 12)
    const pinMat = new THREE.MeshBasicMaterial({ color: PAL.pin })
    const pins = sites.map((s) => {
      const m = new THREE.Mesh(pinGeo, pinMat)
      m.position.copy(toVec(s.lat, s.lon, 1.004))
      scene.add(m)
      return { site: s, mesh: m }
    })

    // 위성과 궤도선
    const t0 = Date.now()
    const sats = omm.omm.map((o, i) => {
      const rec = json2satrec(o)
      const color = new THREE.Color(PAL.sats[i % PAL.sats.length])
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), new THREE.MeshBasicMaterial({ color }))
      scene.add(dot)
      const periodMin = 1440 / o.MEAN_MOTION
      const pts = []
      for (let k = 0; k <= 120; k++) {
        const p = satPoint(rec, new Date(t0 + (k / 120) * periodMin * 60000))
        if (p) pts.push(p)
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }))
      scene.add(line)
      return { rec, dot }
    })

    const size = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = w + 'px'
      renderer.domElement.style.height = h + 'px'
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(el)

    let fly = null
    const v = new THREE.Vector3()
    let lastClock = 0
    renderer.setAnimationLoop((now) => {
      const sim = new Date(t0 + (Date.now() - t0) * SPEED)
      for (const s of sats) { const p = satPoint(s.rec, sim); if (p) s.dot.position.copy(p) }
      if (now - lastClock > 500) { lastClock = now; setSimTime(sim) }
      if (fly) {
        const k = Math.min(1, (now - fly.start) / fly.ms)
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
        const dir = fly.from.clone().normalize().lerp(fly.to.clone().normalize(), e).normalize()
        camera.position.copy(dir.multiplyScalar(fly.fromLen + (fly.toLen - fly.fromLen) * e))
        camera.lookAt(0, 0, 0)
        if (k >= 1) { const done = fly.done; fly = null; done() }
      } else {
        controls.update()
      }
      renderer.render(scene, camera)
      // 핀 이름표 위치. 지구 뒤편이면 숨긴다. 확대할수록 핀을 작게 그린다
      const ps = Math.min(1, Math.max(0.08, (camera.position.length() - 1) / 2.6))
      for (const p of pins) p.mesh.scale.setScalar(ps)
      const w = el.clientWidth, h = el.clientHeight
      for (const p of pins) {
        const node = pinRefs.current[p.site.id]
        if (!node) continue
        const facing = p.mesh.position.clone().normalize().dot(camera.position.clone().normalize()) > 0.15
        v.copy(p.mesh.position).project(camera)
        const [ox, oy] = p.site.labelOffset || [12, -12]
        // 이름표가 화면 오른쪽 끝을 넘으면 핀 왼쪽으로 옮기고, 그래도 넘치면 화면 안으로 붙인다
        const px = (v.x * 0.5 + 0.5) * w
        const nw = node.offsetWidth
        let x = px + ox
        if (x + nw > w - 4) x = px - ox - nw
        x = Math.min(Math.max(x, 4), Math.max(4, w - nw - 4))
        node.style.transform = `translate(${x}px, ${(-v.y * 0.5 + 0.5) * h + oy}px)`
        node.style.visibility = facing ? 'visible' : 'hidden'
      }
    })

    api.current = {
      flyTo(site, done) {
        controls.enabled = false
        const to = toVec(site.lat, site.lon, 1.18)
        if (prefersReducedMotion()) { camera.position.copy(to); camera.lookAt(0, 0, 0); done(); return }
        fly = { from: camera.position.clone(), to, fromLen: camera.position.length(), toLen: 1.18, start: performance.now(), ms: 1600, done }
      }
    }

    return () => {
      alive = false
      ro.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      scene.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose() } })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [sites, omm, tick])

  const pick = (site) => {
    if (flying) return
    setFlying(site.id)
    api.current?.flyTo(site, () => onPick(site))
  }

  const fmt = (d) => `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}. ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`

  return (
    <>
      <PageHead title="사업지 지구본" meta={<><span>사업지 {sites.length}곳</span><span>위성 {omm.omm.length}기</span><span className="cs-num">모의 시계 {SPEED}배속 {fmt(simTime)}</span></>} />
      <div className="cs-two">
        <div className="cs-stage">
          <div ref={host} className="cs-stage-fill" />
          <div className="cs-stage-fill" style={{ pointerEvents: 'none' }}>
            {sites.map((s) => (
              <button key={s.id} ref={(n) => { pinRefs.current[s.id] = n }} type="button" onClick={() => pick(s)} className="cs-pinlabel" style={{ visibility: 'hidden' }}>
                {s.name}
              </button>
            ))}
          </div>
          {flying && <p className="cs-stage-caption" role="status">사업지로 이동합니다.</p>}
        </div>
        <aside className="cs-col">
          <Box title="사업지" sub={`${sites.length}곳`} flush>
            <table className="cs-table">
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td><button type="button" className="cs-rowlink" onClick={() => pick(s)}>{s.name}</button></td>
                    <td className="is-sub">{s.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          <Box title="위성 궤도" flush foot="궤도 요소: CelesTrak GP(2026. 11. 3. 받음)">
            <table className="cs-table">
              <tbody>
                {omm.omm.map((o, i) => (
                  <tr key={o.NORAD_CAT_ID}>
                    <td><span className={`cs-swatch is-sat${i % 3}`} aria-hidden="true" style={{ marginInlineEnd: 'var(--krds-gap-3)' }} />{o.OBJECT_NAME}</td>
                    <td className="is-num is-sub">{o.NORAD_CAT_ID}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </aside>
      </div>
    </>
  )
}
