// 清理测试产物（上传前：删除测试文件、测试图片、临时目录、无引用死代码）
// 保留：正式源码/配置/证书/SDK 包/构建脚本/可复用工具脚本
const fs = require('fs');
const path = require('path');
const ROOT = 'c:/Users/Administrator/Desktop/ywj';

const FILES = [
  // 根目录：调试日志/文本产物
  '.DS_Store',
  '_ad_dump2.txt',
  '_adcap2.txt',
  '_adcap_clean.txt',
  '_adcap_clean_v1_utf8_ok.txt',
  '_adcap_clean_v2_utf8_ok.txt',
  '_adcap_clean_v3gbk_bad.txt',
  '_restored_ad_log.txt',
  '_restored_ad_log2.txt',
  '_restored_ad_log3.txt',
  '_scan_result.txt',
  '_t1.txt',
  '_vip_log.txt',
  'ad_log.txt',
  'ad_log2.txt',
  'ad_log3.txt',
  'ad_log4.txt',
  'hs_err_pid10568.log',
  'replay_pid10568.log',
  // 根目录：一次性临时脚本
  '_cap_loop.ps1',
  '_fix_icon.ps1',
  '_tmp_javap_atinfo.ps1',
  '_tmp_scan_iqiyi.ps1',
  // 根目录：UI dump
  'ui_dump.xml',
  'ui2_dump.xml',
  'ui3_dump.xml',
  'ui4_dump.xml',
  // 根目录：测试截图
  'adchk.png',
  'adchk2.png',
  'adchk3.png',
  '_diag_screenshot.png',
  '_s1.png',
  '_smoke_test_screenshot.png',
  // 根目录：下载页草稿 / 微信开发者工具误开残留 / 测试 aar（全项目无引用）
  'index1.html',
  'project.config.json',
  'project.private.config.json',
  'demo-core-check.aar',
  // scripts：检查输出与证书提取测试文件
  'scripts/_out_aar_str.txt',
  'scripts/_out_big.txt',
  'scripts/_out_bridge.txt',
  'scripts/_out_build_community.txt',
  'scripts/_out_cmp_dbg_rel.txt',
  'scripts/_out_dbg_sign.txt',
  'scripts/_out_dex.txt',
  'scripts/_out_final.txt',
  'scripts/_out_java.txt',
  'scripts/_out_ltmb_d.txt',
  'scripts/_out_manifest.txt',
  'scripts/_out_manifest_full.txt',
  'scripts/_out_manifest_old.txt',
  'scripts/_out_old.txt',
  'scripts/_out_sign.txt',
  'scripts/_out_uniapp_sign.txt',
  'scripts/_out_versions.txt',
  'scripts/_out_yefiot.txt',
  'scripts/_cert_test.der',
  'scripts/_cert_yunweijia.der'
];

const DIRS = [
  '_tmp_apk_sig',       // APK 签名提取临时
  '_tmp_extract',       // aar 解包临时
  '_tmp_www_test',      // 测试用 www 副本
  '_brand_tools',       // 空目录
  'api/test',           // 死代码：$api.test 无引用，user.js 与 api/user/user.js 重复
  'scripts/_ltmb_cls'   // Litemize class 提取产物
];

const results = [];
function rm(rel, isDir) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { results.push(['MISS', rel]); return; }
  try {
    fs.rmSync(p, { recursive: true, force: true });
    results.push([isDir ? 'DEL-D' : 'DEL-F', rel]);
  } catch (e) {
    results.push(['FAIL', rel + ' :: ' + e.message]);
  }
}
FILES.forEach((f) => rm(f, false));
DIRS.forEach((d) => rm(d, true));

for (const [s, r] of results) console.log(s + '  ' + r);
const del = results.filter((r) => r[0].startsWith('DEL')).length;
const miss = results.filter((r) => r[0] === 'MISS').length;
const fail = results.filter((r) => r[0] === 'FAIL').length;
console.log('---');
console.log('已删除: ' + del + '  已不存在: ' + miss + '  失败: ' + fail);

// 残留复查：根目录是否还有测试特征文件
const leftovers = [];
for (const n of fs.readdirSync(ROOT)) {
  if (/^(_tmp|_ad|_restored|_cap|_diag|_s1|_scan_result|_t1|_vip|ad_log|adchk|hs_err|replay|ui\d*_dump)/.test(n)) leftovers.push(n);
}
console.log('根目录残留可疑项: ' + (leftovers.length ? leftovers.join(', ') : '无'));

