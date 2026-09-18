const fs = require('fs');
const zlib = require('zlib');

function analyze(file) {
  const b = fs.readFileSync(file);
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  const bitDepth = b[24];
  const colorType = b[25];
  // collect IDAT chunks
  let pos = 8; const idat = [];
  while (pos < b.length - 8) {
    const len = b.readUInt32BE(pos);
    const type = b.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') idat.push(b.slice(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const filter = raw[0];
  // reconstruct first scanline (handle filter 0/1/2/3/4 on first row; only need corner pixels)
  const row = Buffer.alloc(width * bpp);
  for (let i = 0; i < width * bpp; i++) {
    const x = raw[1 + i];
    const a = i >= bpp ? row[i - bpp] : 0;
    let v = x;
    if (filter === 1) v = (x + a) & 0xff;
    else if (filter === 2) v = x;
    else if (filter === 3) v = (x + (a >> 1)) & 0xff;
    else if (filter === 4) v = x; // approx ignore paeth for corner check
    row[i] = v;
  }
  const px = (i) => colorType === 6 ? [row[i * 4], row[i * 4 + 1], row[i * 4 + 2], row[i * 4 + 3]] : [row[i * 3], row[i * 3 + 1], row[i * 3 + 2], 255];
  console.log(file.split('/').pop(), width + 'x' + height, 'colorType=' + colorType, 'bitDepth=' + bitDepth, 'filter=' + filter);
  console.log('  corner(0,0):', px(0).join(','));
  console.log('  corner(2,2):', px(2).join(','));
  console.log('  center:', px((Math.floor(width / 2) + Math.floor(width / 2) * width)).join(','));
}

analyze('c:/Users/Administrator/Desktop/ywj/static/logo.png');
analyze('c:/Users/Administrator/Desktop/ywj/unpackage/res/icons/512x512.png');
