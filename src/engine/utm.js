// WGS84 경위도와 UTM(횡메르카토르) 변환. Krüger 6차 급수(Karney 2011)로 1 mm 이내 정확도.
// Sentinel-2 영상은 UTM(EPSG 326xx 북반구, 327xx 남반구)으로 저장되므로 창 읽기 위치를 이 함수로 계산한다
const A = 6378137
const F = 1 / 298.257223563
const K0 = 0.9996
const N = F / (2 - F)
const AA = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64 + N ** 6 / 256)
const ALPHA = [
  N / 2 - (2 / 3) * N ** 2 + (5 / 16) * N ** 3 + (41 / 180) * N ** 4 - (127 / 288) * N ** 5 + (7891 / 37800) * N ** 6,
  (13 / 48) * N ** 2 - (3 / 5) * N ** 3 + (557 / 1440) * N ** 4 + (281 / 630) * N ** 5 - (1983433 / 1935360) * N ** 6,
  (61 / 240) * N ** 3 - (103 / 140) * N ** 4 + (15061 / 26880) * N ** 5 + (167603 / 181440) * N ** 6,
  (49561 / 161280) * N ** 4 - (179 / 168) * N ** 5 + (6601661 / 7257600) * N ** 6,
  (34729 / 80640) * N ** 5 - (3418889 / 1995840) * N ** 6,
  (212378941 / 319334400) * N ** 6
]
const BETA = [
  N / 2 - (2 / 3) * N ** 2 + (37 / 96) * N ** 3 - (1 / 360) * N ** 4 - (81 / 512) * N ** 5 + (96199 / 604800) * N ** 6,
  (1 / 48) * N ** 2 + (1 / 15) * N ** 3 - (437 / 1440) * N ** 4 + (46 / 105) * N ** 5 - (1118711 / 3870720) * N ** 6,
  (17 / 480) * N ** 3 - (37 / 840) * N ** 4 - (209 / 4480) * N ** 5 + (5569 / 90720) * N ** 6,
  (4397 / 161280) * N ** 4 - (11 / 504) * N ** 5 - (830251 / 7257600) * N ** 6,
  (4583 / 161280) * N ** 5 - (108847 / 3991680) * N ** 6,
  (20648693 / 638668800) * N ** 6
]
const E = Math.sqrt(F * (2 - F))
const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

export const zoneOf = (lon) => Math.floor((lon + 180) / 6) + 1
export const epsgOf = (lon, lat) => (lat >= 0 ? 32600 : 32700) + zoneOf(lon)
export function zoneFromEpsg(epsg) {
  const e = Number(epsg)
  if (e > 32600 && e <= 32660) return { zone: e - 32600, south: false }
  if (e > 32700 && e <= 32760) return { zone: e - 32700, south: true }
  return null
}

export function toUtm(lon, lat, zone = zoneOf(lon), south = lat < 0) {
  const phi = rad(lat)
  const lam = rad(lon - (zone * 6 - 183))
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)))
  const xi1 = Math.atan2(t, Math.cos(lam))
  const eta1 = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t))
  let xi = xi1
  let eta = eta1
  for (let j = 1; j <= 6; j += 1) {
    xi += ALPHA[j - 1] * Math.sin(2 * j * xi1) * Math.cosh(2 * j * eta1)
    eta += ALPHA[j - 1] * Math.cos(2 * j * xi1) * Math.sinh(2 * j * eta1)
  }
  return { x: 500000 + K0 * AA * eta, y: (south ? 10000000 : 0) + K0 * AA * xi, zone, south }
}

export function fromUtm(x, y, zone, south = false) {
  const xi = (y - (south ? 10000000 : 0)) / (K0 * AA)
  const eta = (x - 500000) / (K0 * AA)
  let xi1 = xi
  let eta1 = eta
  for (let j = 1; j <= 6; j += 1) {
    xi1 -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta)
    eta1 -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta)
  }
  const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1))
  // 등각 위도에서 측지 위도로 되돌리는 반복
  let phi = chi
  for (let i = 0; i < 8; i += 1) {
    const s = Math.sin(phi)
    phi = Math.asin(Math.tanh(Math.atanh(Math.sin(chi)) + E * Math.atanh(E * s)))
  }
  const lam = Math.atan2(Math.sinh(eta1), Math.cos(xi1))
  return { lon: deg(lam) + (zone * 6 - 183), lat: deg(phi) }
}
