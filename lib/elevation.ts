// 国土地理院の標高タイル（dem_png、10m メッシュ）から標高を取る。ブラウザ側でのみ使う。
// タイルは地図と同じ形の画像で、色（RGB）が標高を表す。配信側が CORS を許可しているので canvas で色を読める

const DEM_ZOOM = 14
const DEM_URL = (x: number, y: number) => `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${DEM_ZOOM}/${x}/${y}.png`
const TILE_SIZE = 256

// タイルごとに1回だけ読む（同じタイルの点が続くため）。読めない（海・国外）タイルは null
const tileCache = new Map<string, Promise<ImageData | null>>()

function loadTile(x: number, y: number): Promise<ImageData | null> {
    const key = `${x}/${y}`
    const cached = tileCache.get(key)
    if (cached) return cached
    const p = new Promise<ImageData | null>(resolve => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = TILE_SIZE
            canvas.height = TILE_SIZE
            const ctx = canvas.getContext("2d")
            if (!ctx) { resolve(null); return }
            ctx.drawImage(img, 0, 0)
            resolve(ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE))
        }
        img.onerror = () => resolve(null)
        img.src = DEM_URL(x, y)
    })
    tileCache.set(key, p)
    return p
}

// 緯度経度 → タイル番号とタイル内の画素の位置（Web メルカトル）
function tilePixel(lat: number, lon: number) {
    const n = 2 ** DEM_ZOOM
    const latRad = lat * Math.PI / 180
    const fx = (lon + 180) / 360 * n
    const fy = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    const x = Math.floor(fx)
    const y = Math.floor(fy)
    return { x, y, px: Math.min(TILE_SIZE - 1, Math.floor((fx - x) * TILE_SIZE)), py: Math.min(TILE_SIZE - 1, Math.floor((fy - y) * TILE_SIZE)) }
}

// 色 → 標高（m）。地理院の仕様: x = R×2^16 + G×2^8 + B、x = 2^23 は値なし、x > 2^23 は負の標高
function decode(r: number, g: number, b: number): number | null {
    const v = r * 65536 + g * 256 + b
    if (v === 8388608) return null
    return (v < 8388608 ? v : v - 16777216) * 0.01
}

export async function elevationAt(lat: number, lon: number): Promise<number | null> {
    const { x, y, px, py } = tilePixel(lat, lon)
    const tile = await loadTile(x, y)
    if (!tile) return null
    const i = (py * TILE_SIZE + px) * 4
    return decode(tile.data[i], tile.data[i + 1], tile.data[i + 2])
}
