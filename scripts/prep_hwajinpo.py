"""erosion_poc(화진포 개념 증명 결과)를 화면용 GeoJSON과 PNG로 바꿈.
가로선 방향은 poc_results.json에 없어 shoreline_poc.py와 같은 절차로 다시 계산함.
사용: python3 scripts/prep_hwajinpo.py <erosion_poc 폴더>"""
import json, math, sys, os, numpy as np
from PIL import Image
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "sites", "hwajinpo")
os.makedirs(OUT, exist_ok=True)
E0, N1, RES = 450400.0, 4260100.0, 10.0
meta = json.load(open(os.path.join(SRC, "scenes_meta.json")))
SC = list(meta)
res = json.load(open(os.path.join(SRC, "poc_results.json")))

def utm_to_ll(E, N, zone=52):
    a = 6378137.0; f = 1 / 298.257223563; e2 = f * (2 - f); k0 = 0.9996
    x = E - 500000.0; y = N
    ep2 = e2 / (1 - e2); M = y / k0
    mu = M / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    p1 = mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu) + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu) \
        + (151 * e1**3 / 96) * math.sin(6 * mu) + (1097 * e1**4 / 512) * math.sin(8 * mu)
    C1 = ep2 * math.cos(p1)**2; T1 = math.tan(p1)**2
    N1_ = a / math.sqrt(1 - e2 * math.sin(p1)**2); R1 = a * (1 - e2) / (1 - e2 * math.sin(p1)**2)**1.5
    D = x / (N1_ * k0)
    lat = p1 - (N1_ * math.tan(p1) / R1) * (D**2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1**2 - 9 * ep2) * D**4 / 24
          + (61 + 90 * T1 + 298 * C1 + 45 * T1**2 - 252 * ep2 - 3 * C1**2) * D**6 / 720)
    lon = (D - (1 + 2 * T1 + C1) * D**3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1**2 + 8 * ep2 + 24 * T1**2) * D**5 / 120) / math.cos(p1)
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    return [round(math.degrees(lon0 + lon), 7), round(math.degrees(lat), 7)]

def px_to_ll(px, py):
    return utm_to_ll(E0 + px * RES, N1 - py * RES)

# 가로선 방향 재계산(shoreline_poc.py 1~2단계와 같음)
def otsu(v):
    v = v[np.isfinite(v)]; h, e = np.histogram(v, 256, (-1, 1)); c = (e[:-1] + e[1:]) / 2
    w0 = np.cumsum(h); w1 = w0[-1] - w0; m0 = np.cumsum(h * c); mt = m0[-1]
    with np.errstate(all="ignore"):
        bv = (mt * w0 / w0[-1] - m0) ** 2 / (w0 * w1)
    return float(c[np.nanargmax(bv)])
def nd(s):
    d = np.load(os.path.join(SRC, f"data_{s}.npz")); g = d["green"].astype(float); n = d["nir"].astype(float)
    return (g - n) / (g + n + 1e-9)
med = np.median([nd(s) for s in SC], axis=0); thr = otsu(med)
ref = []
for y in range(50, 146):
    row = med[y]; x = row.shape[0] - 4
    while x > 3 and not np.all(row[x - 2:x + 1] <= thr): x -= 1
    ref.append((x + 0.5, y + 0.5))
ref = np.array(ref); k = 9; pad = np.pad(ref, ((k // 2, k // 2), (0, 0)), mode="edge")
ref_s = np.array([pad[i:i + k].mean(0) for i in range(len(ref))])
seg = np.hypot(*np.diff(ref_s, axis=0).T); cum = np.r_[0, np.cumsum(seg)]
dirs, starts = [], []
for st in np.arange(3.0, cum[-1] - 3.0, 6.0):
    i = np.searchsorted(cum, st) - 1; t = (st - cum[i]) / seg[i]
    p = ref_s[i] + t * (ref_s[i + 1] - ref_s[i])
    j0, j1 = max(i - 3, 0), min(i + 4, len(ref_s) - 1)
    tan = ref_s[j1] - ref_s[j0]; tan /= np.hypot(*tan)
    nrm = np.array([tan[1], -tan[0]])
    if nrm[0] < 0: nrm = -nrm
    starts.append(p + nrm * 15.0); dirs.append(-nrm)
assert len(starts) == len(res["transects"]), "가로선 수 불일치"
for s, t in zip(starts, res["transects"]):
    utm = (E0 + s[0] * RES, N1 - s[1] * RES)
    assert abs(utm[0] - t["start_utm"][0]) < 1 and abs(utm[1] - t["start_utm"][1]) < 1, "시작점 불일치"

# 장면별 해안선과 가로선
order = ["S2A_52SDH_20170413_0_L2A", "S2A_52SDH_20170503_0_L2A", "S2B_52SDH_20250426_0_L2A", "S2A_52SDH_20250530_0_L2A"]
def dist(t, sid):
    i = order.index(sid)
    return (t["ndwi_2017_scenes_m"] + t["ndwi_2025_scenes_m"])[i]
feats = []
for sid in order:
    coords = [px_to_ll(*(s + d * dist(t, sid) / RES)) for s, d, t in zip(starts, dirs, res["transects"])]
    feats.append({"type": "Feature", "properties": {"scene": sid, "date": res["scenes"][sid]["datetime_utc"][:10]},
                  "geometry": {"type": "LineString", "coordinates": coords}})
json.dump({"type": "FeatureCollection", "features": feats}, open(os.path.join(OUT, "shorelines.geojson"), "w"))
tf = []
for s, d, t in zip(starts, dirs, res["transects"]):
    tf.append({"type": "Feature", "properties": {"id": t["id"], "dist_m": dict(zip(order, t["ndwi_2017_scenes_m"] + t["ndwi_2025_scenes_m"]))},
               "geometry": {"type": "LineString", "coordinates": [px_to_ll(*s), px_to_ll(*(s + d * 30.0))]}})
json.dump({"type": "FeatureCollection", "features": tf}, open(os.path.join(OUT, "transects.geojson"), "w"))

# 준공 전후 비교용 컬러 합성(같은 범위, 4배 최근접 확대)
def rgb_png(sid, name):
    d = np.load(os.path.join(SRC, f"data_{sid}.npz"))
    a = np.dstack([d[b].astype(float) * 1e-4 for b in ["red", "green", "blue"]])
    a = np.clip(a / 0.18, 0, 1) ** (1 / 1.6)
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((a.shape[1] * 4, a.shape[0] * 4), Image.NEAREST)
    im.save(os.path.join(OUT, name), optimize=True)
rgb_png("S2A_52SDH_20170413_0_L2A", "before_20170413.png")
rgb_png("S2B_52SDH_20250426_0_L2A", "after_20250426.png")
h, w = med.shape
bounds = [px_to_ll(0, 0), px_to_ll(w, 0), px_to_ll(w, h), px_to_ll(0, h)]
json.dump({"scenes": [{"id": s, "date": res["scenes"][s]["datetime_utc"][:10]} for s in order],
           "image_corners": bounds, "ndwi_summary": res["ndwi_summary"], "n_transects": res["n_transects"], "spacing_m": res["spacing_m"]},
          open(os.path.join(OUT, "summary.json"), "w"), ensure_ascii=False, indent=1)
print("ok", bounds[0], len(feats), len(tf))
