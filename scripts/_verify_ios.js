// 验证 iOS 打包工程修复项
const fs = require('fs');
const p = (x) => 'c:/Users/Administrator/Desktop/ywj/' + x;

let ok = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { ok++; console.log('  [OK]', name, extra || ''); }
  else { fail++; console.log('  [FAIL]', name, extra || ''); }
}

console.log('=== 1. Assets.xcassets ===');
const c1 = JSON.parse(fs.readFileSync(p('shell-ios/CloudGuard/Assets.xcassets/Contents.json'), 'utf8'));
check('根 Contents.json 解析', !!c1.info);
const c2 = JSON.parse(fs.readFileSync(p('shell-ios/CloudGuard/Assets.xcassets/AppIcon.appiconset/Contents.json'), 'utf8'));
check('AppIcon Contents.json 解析', c2.images && c2.images[0].filename === 'Icon-1024.png', JSON.stringify(c2.images[0]));
check('Icon-1024.png 存在', fs.existsSync(p('shell-ios/CloudGuard/Assets.xcassets/AppIcon.appiconset/Icon-1024.png')));
const icon = fs.readFileSync(p('shell-ios/CloudGuard/Assets.xcassets/AppIcon.appiconset/Icon-1024.png'));
check('图标无 alpha (colorType=2)', icon[25] === 2, 'colorType=' + icon[25] + ' ' + icon.readUInt32BE(16) + 'x' + icon.readUInt32BE(20));

console.log('=== 2. project.yml ===');
const yml = fs.readFileSync(p('shell-ios/project.yml'), 'utf8');
check('bundle id = communityios', yml.includes('PRODUCT_BUNDLE_IDENTIFIER: com.yefiot.communityios'));
check('无旧 bundle id 残留', !yml.includes('com.yefiot.cloudguard'));
check('DEVELOPMENT_TEAM 已填', yml.includes('DEVELOPMENT_TEAM: "737647MFYB"'));
check('APPICON 设置', yml.includes('ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon'));

console.log('=== 3. Info.plist ===');
const plist = fs.readFileSync(p('shell-ios/CloudGuard/Info.plist'), 'utf8');
check('CFBundleIcons 已加', plist.includes('<key>CFBundleIcons</key>') && plist.includes('<string>AppIcon</string>'));
const open = (plist.match(/<dict>/g) || []).length;
const close = (plist.match(/<\/dict>/g) || []).length;
check('<dict> 标签配对', open === close, open + '/' + close);

console.log('=== 4. 后端配置 ===');
const php = fs.readFileSync(p('backend-vip-php/v1/vip_pay_config.php'), 'utf8');
check('apple.bundle_id = communityios', php.includes("'bundle_id' => 'com.yefiot.communityios'"));

console.log('=== 5. 文档 ===');
const md = fs.readFileSync(p('shell-ios/iOS编译接入说明.md'), 'utf8');
check('文档无旧 bundle id', !md.includes('com.yefiot.cloudguard'));
check('文档含 communityios', md.includes('com.yefiot.communityios'));

console.log('\n结果: ' + ok + ' 项通过, ' + fail + ' 项失败');
process.exit(fail ? 1 : 0);
