export default {
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    },
    get_timestamp() { // 返回的是字条串类型
        return Math.floor(new Date().getTime() / 1000)
    },
    get_current_date() { // 取当前日期
        let date = new Date();
        let year = date.getFullYear();
        let month = (date.getMonth() + 1).toString().padStart(2, '0');
        let day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    // 时间(如'12:00')转成时间戳
    time_to_timestamp(time_str) {
        let timeStr = '1970-01-01T' + time_str + 'Z';
        let timestamp = Date.parse(timeStr);
        if (timestamp) {
            return Math.floor(timestamp / 1000);
        }
    },
    // 把时间戳转时间
    timestamp_to_time(timestamp) {
        // 转换为 Date 对象
        let date = new Date(timestamp * 1000);
        // 设置时区为UTC+0
        date.setTime(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
        // 获取小时和分钟
        let hours = date.getHours();
        let minutes = date.getMinutes();
        // 拼接时间字符串
        let timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        return timeStr;
    },
    // 日期转时间戳
    date_to_timestamp(date_str) {
        // 转为Date对象  
        let date = new Date(date_str.replace(/-/g, '/')); // 把2023-09-25 16:43:32转成2023/09/25 16:43:32，为了兼容某些iOS版本

        // 获取时间戳
        let timestamp = date.getTime();
        return Math.floor(timestamp / 1000);
    },
    // 时间戳转日期
    timestamp_to_date(timestamp) {
        // 转为Date对象
        let date = new Date(timestamp * 1000);
        // 设置时区为
        date.setTime(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
        // 格式化日期字符串
        let dateStr = date.toISOString().split('T')[0];

        return dateStr;
    },
    // 时间戳转日期时间
    timestamp_to_datetime(timestamp) {
        // 转为Date对象
        let date = new Date(timestamp * 1000);

        // 格式化日期字符串
        let year = date.getFullYear();
        let month = (date.getMonth() + 1).toString().padStart(2, '0');
        let day = date.getDate().toString().padStart(2, '0');
        let hours = date.getHours().toString().padStart(2, '0');
        let minutes = date.getMinutes().toString().padStart(2, '0');
        let seconds = date.getSeconds().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },
    date_to_hex(d) {
        let ts = this.date_to_timestamp(d) || 0
        return ts.toString(16).padStart(8, '0')
    },
    hex_to_date(hexs) {
        let ts = parseInt(hexs, 16)
        if (ts == 0) {
            return ''
        }
        return this.timestamp_to_date(ts)
    },
    time_to_hex(t) {
        let ts = this.time_to_timestamp(t) || 0
        let v = Math.floor(ts / 60) // 除以60倍率
        return v.toString(16).padStart(4, '0')
    },
    hex_to_time(hexs) {
        let ts = parseInt(hexs, 16) * 60
        return this.timestamp_to_time(ts)
    },
    // 计算整数和余数
    divmod(num, divisor) {
        let quotient = Math.floor(num / divisor);
        let remainder = num % divisor;

        return [quotient, remainder];
    },
    // 生成唯一id
    gen_id() {
        return Date.now().toString(36)
    },
    // 解析url参数
    parse_url_params(url) {
        const paramRegex = /[\?&]([^=]+)=([^&#]*)/g;

        let res = {};
        let match;
        while ((match = paramRegex.exec(url))) {
            let paramName = decodeURIComponent(match[1]);
            let paramValue = decodeURIComponent(match[2]);

            res[paramName] = paramValue;
        }
        return res;
    },
    // 根据起始生成数组
    range(start, end) {
        return Array.from(Array(end - start + 1), (_, i) => i + start)
    },
    // 取时间范围，用于时间选择器，type取值：start:范围开始日期 end: 范围结束日期
    get_date_range(type) {
        const date = new Date();
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();

        if (type === 'start') {
            year = year - 10;
        } else if (type === 'end') {
            year = year + 10;
        }
        month = month > 9 ? month : '0' + month;
        day = day > 9 ? day : '0' + day;
        return `${year}-${month}-${day}`;
    },
    // 取当前时间，并格式化成20231005092130这样的串
    get_cur_time_str() {
        let now = new Date();
        let year = now.getFullYear();
        let month = (now.getMonth() + 1).toString().padStart(2, '0');
        let day = now.getDate().toString().padStart(2, '0');
        let hours = now.getHours().toString().padStart(2, '0');
        let minutes = now.getMinutes().toString().padStart(2, '0');
        let seconds = now.getSeconds().toString().padStart(2, '0');

        let formattedTime = year + month + day + hours + minutes + seconds;
        return formattedTime;
    },
    getDate(type) {
        const date = new Date();
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();

        if (type === 'start') {
            if (month == 1){
                year = year - 1;
                month = 12;
            } else {
                month = month - 1;
            }
            day = 1;
        } else if (type === 'end') {
            //year = year + 2;
        }
        month = month > 9 ? month : '0' + month;;
        day = day > 9 ? day : '0' + day;
        return `${year}-${month}-${day}`;
    }
}