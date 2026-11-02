// 장면 1. 순수 three.js 지구본. 위성 궤도는 satellite.js 로 계산하고, 궤도 요소는 미리 받아 둔 정적 OMM 파일을 쓴다
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js'
import { PAL } from '../lib/palette.js'
import { prefersReducedMotion } from '../miri/motion/useReducedMotion.js'

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

export default function GlobeScene({ sites, omm, schedule, onPick }) {
  const host = useRef(null)
  const pinRefs = useRef({})
  const api = useRef(null)
  const [simTime, setSimTime] = useState(() => new Date())
  const [flying, setFlying] = useState(null)

  useEffect(() => {
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
        node.style.transform = `translate(${(v.x * 0.5 + 0.5) * w + ox}px, ${(-v.y * 0.5 + 0.5) * h + oy}px)`
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
  }, [sites, omm])

  const pick = (site) => {
    if (flying) return
    setFlying(site.id)
    api.current?.flyTo(site, () => onPick(site))
  }

  const fmt = (d) => `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}. ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="relative min-h-[420px] overflow-hidden rounded-md bg-text-pri" data-figma="globe-stage">
        <div ref={host} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0">
          {sites.map((s) => (
            <button
              key={s.id}
              ref={(n) => { pinRefs.current[s.id] = n }}
              type="button"
              onClick={() => pick(s)}
              className="pressable pointer-events-auto absolute left-0 top-0 flex items-center gap-2 rounded-md bg-page px-3 py-2 shadow-md"
              style={{ visibility: 'hidden' }}
            >
              <span className="type-strong text-text-pri whitespace-nowrap">{s.name}</span>
            </button>
          ))}
        </div>
        <p className="absolute bottom-3 left-3 rounded-md bg-text-pri px-3 py-1 type-meta text-text-inverse tabular-nums">
          모의 시계 {SPEED}배속 {fmt(simTime)}
        </p>
        {flying && (
          <p className="absolute right-3 top-3 rounded-md bg-page px-3 py-2 type-strong text-text-pri shadow-md">사업지로 이동 중</p>
        )}
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-auto">
        <section className="rounded-md bg-canvas p-4">
          <h2 className="type-h3 text-text-pri">사업지 3곳</h2>
          <p className="mt-1 type-body-sm text-text-sec">핀을 누르면 사업지로 확대한 뒤<br />해안선 지도로 넘어갑니다.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {sites.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => pick(s)} className="pressable flex w-full items-center justify-between gap-3 rounded-md bg-page px-3 py-3 text-left">
                  <span>
                    <span className="block type-strong text-text-pri">{s.name}</span>
                    <span className="block type-meta text-text-meta">{s.region}, {s.country}</span>
                  </span>
                  <span className="type-caption text-primary">지도 보기</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md bg-canvas p-4">
          <h2 className="type-h3 text-text-pri">위성 궤도</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {omm.omm.map((o, i) => (
              <li key={o.NORAD_CAT_ID} className="flex items-center gap-2 type-body-sm text-text-pri">
                <span className="h-2 w-4 rounded-full" style={{ background: PAL.sats[i % PAL.sats.length] }} aria-hidden="true" />
                {o.OBJECT_NAME}
                <span className="ml-auto type-meta text-text-meta tabular-nums">NORAD {o.NORAD_CAT_ID}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 type-meta text-text-meta">궤도 요소: CelesTrak GP 자료를 2026. 11. 3.<br />한 번 받아 둔 정적 파일입니다.<br />화면은 외부 호출 없이<br />이 파일로 궤도를 계산합니다.</p>
        </section>

        <section className="rounded-md bg-canvas p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="type-h3 text-text-pri">다음 촬영 일정</h2>
            <span className="rounded-md bg-warning px-2 py-1 type-caption text-text-inverse">{schedule.label}</span>
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {schedule.items.map((it) => (
              <li key={it.date + it.mission} className="flex justify-between type-body-sm text-text-pri tabular-nums">
                <span>{it.mission}</span><span>{it.date.split('-').map(Number).join('. ')}.</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 type-meta text-text-meta">공개 재방문 주기로 만든 예시 일정입니다.<br />실제 촬영 계획 조회 결과와 다릅니다.</p>
        </section>
      </aside>
    </div>
  )
}
