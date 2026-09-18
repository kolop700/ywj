// 解析 iOS mobileprovision 描述文件：输出名称、App ID、团队、类型、有效期、设备数
const fs = require('fs');

const file = process.argv[2];
const buf = fs.readFileSync(file);
const text = buf.toString('latin1'); // 二进制安全读取

const start = text.indexOf('<?xml');
const end = text.indexOf('</plist>');
if (start < 0 || end < 0) {
  console.log('未找到内嵌 plist（可能不是 mobileprovision）');
  process.exit(1);
}
const xml = text.slice(start, end + 8);

// 轻量提取关键字段（避免引入 xml 解析依赖）
function pick(key, src) {
  const re = new RegExp('<' + key + '>([\\s\\S]*?)</' + key + '>');
  const m = src.match(re);
  return m ? m[1].trim() : '(未找到)';
}
function unescape(x) {
  return x.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

const name = unescape(pick('Name', xml));
const uuid = unescape(pick('UUID', xml));
const team = unescape(pick('TeamIdentifier', xml));
const teamNameMatch = xml.match(/<key>TeamName<\/key>\s*<string>([\s\S]*?)<\/string>/);
const appIdMatch = xml.match(/<key>application-identifier<\/key>\s*<string>([\s\S]*?)<\/string>/);
const expMatch = xml.match(/<key>ExpirationDate<\/key>\s*<date>([\s\S]*?)<\/date>/);
const taskAllow = xml.includes('<key>get-task-allow</key>') ? (xml.match(/<key>get-task-allow<\/key>\s*<(true|false)\/>/) || [])[1] : '(无)';
const devicesMatch = xml.match(/<key>ProvisionedDevices<\/key>\s*<array>([\s\S]*?)<\/array>/);
const devCount = devicesMatch ? (devicesMatch[1].match(/<string>/g) || []).length : 0;
const networksMatch = xml.match(/<key>ProvisionsAllDevices<\/key>\s*<true\/>/);

console.log('=== mobileprovision 解析 ===');
console.log('文件名:', file.split(/[\\/]/).pop());
console.log('描述文件名称:', name);
console.log('UUID:', uuid);
console.log('团队 ID:', team, '/', teamNameMatch ? unescape(teamNameMatch[1]) : '');
console.log('application-identifier:', appIdMatch ? unescape(appIdMatch[1]) : '(未找到)');
console.log('类型:', networksMatch ? '企业分发(In-House)' : (devCount > 0 ? '开发(Development)' : 'App Store 分发'));
console.log('get-task-allow:', taskAllow);
console.log('包含设备数:', devCount);
console.log('过期时间:', expMatch ? expMatch[1] : '(未找到)');
if (expMatch) {
  const exp = new Date(expMatch[1]);
  const now = new Date();
  const days = Math.floor((exp - now) / 86400000);
  console.log('剩余天数:', days, days > 0 ? '（有效）' : '（已过期！）');
}
