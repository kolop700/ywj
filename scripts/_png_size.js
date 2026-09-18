const fs = require('fs');
const files = [
  'c:/Users/Administrator/Desktop/ywjxcx/images/icon/icon_login.png',
  'c:/Users/Administrator/Desktop/ywjxcx/images/icon/icon_hous_application.png',
  'c:/Users/Administrator/Desktop/ywjxcx/images/icon/icon_my.png',
  'c:/Users/Administrator/Desktop/ywjxcx/images/icon/icon_right.png',
  'c:/Users/Administrator/Desktop/ywjxcx/images/icon/icon_about_us.png',
  'c:/Users/Administrator/Desktop/ywj/static/logo.png',
  'c:/Users/Administrator/Desktop/ywj/unpackage/res/icons/1024x1024.png'
];
for (const f of files) {
  try {
    const b = fs.readFileSync(f);
    console.log(f.split('/').pop().padEnd(32), b.readUInt32BE(16) + 'x' + b.readUInt32BE(20), Math.round(b.length / 1024) + 'KB');
  } catch (e) {
    console.log(f, 'ERR', e.message);
  }
}
