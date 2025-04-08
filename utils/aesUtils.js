// utils/crypto.js

// Base64 编码表
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

/**
 * 自定义 Base64 编码
 * @param {string} str 要编码的字符串
 * @returns {string} Base64 编码后的字符串
 */
function base64Encode(str) {
  let output = ''
  let chr1, chr2, chr3, enc1, enc2, enc3, enc4
  let i = 0
  
  // 转换为 UTF-8
  str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
    function toSolidBytes(match, p1) {
      return String.fromCharCode('0x' + p1)
    })
  
  while (i < str.length) {
    chr1 = str.charCodeAt(i++)
    chr2 = str.charCodeAt(i++)
    chr3 = str.charCodeAt(i++)
    
    enc1 = chr1 >> 2
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
    enc4 = chr3 & 63
    
    if (isNaN(chr2)) {
      enc3 = enc4 = 64
    } else if (isNaN(chr3)) {
      enc4 = 64
    }
    
    output = output +
      BASE64_CHARS.charAt(enc1) + BASE64_CHARS.charAt(enc2) +
      BASE64_CHARS.charAt(enc3) + BASE64_CHARS.charAt(enc4)
  }
  
  return output
}

/**
 * 自定义 Base64 解码
 * @param {string} str Base64 编码的字符串
 * @returns {string} 解码后的字符串
 */
function base64Decode(str) {
  let output = ''
  let chr1, chr2, chr3
  let enc1, enc2, enc3, enc4
  let i = 0
  
  // 移除无效字符
  str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '')
  
  while (i < str.length) {
    enc1 = BASE64_CHARS.indexOf(str.charAt(i++))
    enc2 = BASE64_CHARS.indexOf(str.charAt(i++))
    enc3 = BASE64_CHARS.indexOf(str.charAt(i++))
    enc4 = BASE64_CHARS.indexOf(str.charAt(i++))
    
    chr1 = (enc1 << 2) | (enc2 >> 4)
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
    chr3 = ((enc3 & 3) << 6) | enc4
    
    output = output + String.fromCharCode(chr1)
    
    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2)
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3)
    }
  }
  
  // 转换回 UTF-8
  output = decodeURIComponent(escape(output))
  
  return output
}

/**
 * 简单加密
 * @param {string} data 需要加密的数据
 * @returns {string} 加密后的字符串
 */
export function encrypt(data) {
  try {
    console.log('开始加密，输入数据:', data)
    
    // 1. 将数据转换为字符串
    const str = String(data)
    
    // 2. 简单字符位移（凯撒密码变体）
    const shifted = str.split('').map(char => {
      const code = char.charCodeAt(0)
      return String.fromCharCode(code + 3) // 向后位移3位
    }).join('')
    
    // 3. Base64 编码
    const encoded = base64Encode(shifted)
    
    console.log('加密完成，结果:', encoded)
    return encoded
  } catch (error) {
    console.error('加密失败:', error)
    return ''
  }
}

/**
 * 简单解密
 * @param {string} data 加密后的字符串
 * @returns {string} 解密后的字符串
 */
export function decrypt(data) {
  try {
    console.log('开始解密，输入数据:', data)
    
    // 1. Base64 解码
    const decoded = base64Decode(data)
    
    // 2. 反向位移
    const unshifted = decoded.split('').map(char => {
      const code = char.charCodeAt(0)
      return String.fromCharCode(code - 3) // 向前位移3位
    }).join('')
    
    console.log('解密完成，结果:', unshifted)
    return unshifted
  } catch (error) {
    console.error('解密失败，错误详情:', error)
    return ''
  }
}


// 为了向后兼容，保留原来的函数名
export function generateKey(length = 32) {
  const chars = BASE64_CHARS.slice(0, 62) // 不使用 '+/=' 字符
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}