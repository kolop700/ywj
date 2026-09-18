// 检查 PNG 是否有 alpha 通道（iOS AppIcon 必须无 alpha）
const fs = require('fs');
const zlib = require('zlib');

function analyze(file) {
  const b = fs.readFileSync(file);
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  const bitDepth = b[24];
  const colorType = b[25];
  const hasAlpha = colorType === 4 || colorType === 6;
  console.log(file.split(/[\\/]/).pop(), width + 'x' + height, 'colorType=' + colorType, 'bitDepth=' + bitDepth, '->', hasAlpha ? '【有 alpha 通道】' : '无 alpha');
  if (hasAlpha) {
    // 采样四角 alpha
    let pos = 8; const idat = [];
    while (pos < b.length - 8) {
      const len = b.readUInt32BE(pos);
      const type = b.toString('ascii', pos + 4, pos + 8);
      if (type === 'IDAT') idat.push(b.slice(pos + 8, pos + 8 + len));
      pos += 12 + len;
    }
    try {
      const raw = zlib.inflateSync(Buffer.concat(idat));
      const bpp = 4;
      const stride = width * bpp + 1;
      const firstRowAlpha = [];
      // 只解码需要的行：用 filter 记录近似跳过（这里只对第一行做简单重建）
      let prev = Buffer.alloc(width * bpp);
      let cur = Buffer.alloc(width * bpp);
      const rows = [0, Math.floor(width / 2), height - 1];
      let offset = 0;
      for (let y = 0; y <= height - 1; y++) {
        const f = raw[offset];
        const line = raw.slice(offset + 1, offset + 1 + width * bpp);
        for (let i = 0; i < width * bpp; i++) {
          const x = line[i];
          const a = i >= bpp ? cur[i - bpp] : 0;
          const up = prev[i];
          const ul = i >= bpp ? prev[i - bpp] : 0;
          let v = x;
          if (f === 1) v = (x + a) & 0xff;
          else if (f === 2) v = (x + up) & 0xff;
          else if (f === 3) v = (x + ((a + up) >> 1)) & 0xff;
          else if (f === 4) {
            const p = a + up - ul;
            const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul);
            const pr = pa <= pb && pa <= pc ? a : pb <= pc ? up : ul;
            v = (x + pr) & 0xff;
          }
          cur[i] = v;
        }
        if (rows.includes(y)) {
          const alphas = [cur[3], cur[(Math.floor(width / 2)) * 4 + 3], cur[(width - 1) * 4 + 3]];
          console.log('  row', y, 'alpha(left,center,right) =', alphas.join(','));
        }
        const t = prev; prev = cur; cur = t;
        offset += stride;
      }
    } catch (e) {
      console.log('  (inflate 失败:', e.message + ')');
    }
  }
}

for (const f of process.argv.slice(2)) analyze(f);
