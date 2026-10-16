

function openWin(url,name,iWidth,iHeight) {
    //获得窗口的垂直位置
    var iTop = (window.screen.availHeight - 30 - iHeight) / 2;
    //获得窗口的水平位置
    var iLeft = (window.screen.availWidth - 10 - iWidth) / 2;
    window.open(url, name, 'height=' + iHeight + ',innerHeight=' + iHeight +
    ',width=' + iWidth + ',innerWidth=' + iWidth + ',top=' + iTop + ',left=' + iLeft +
    ',status=no,toolbar=no,menubar=no,location=no,resizable=no,scrollbars=0,titlebar=no');
}

function initDynamicSearch(obj) {
    var fetching_data = [];  // 是否正在查询
    var input_count = [];  // 记录输入数
    var selectFlag = []; // 是否已经将输入法中的文字输入文本框
    var fetch_data = [];
    var bindSelectInput = [];
    var data = [];

    obj = Array.isArray(obj)? obj : [obj];

    for(index in obj){
        fetching_data[index] = false;  // 是否正在查询
        input_count[index] = 0;  // 记录输入数
        selectFlag[index] = true; // 是否已经将输入法中的文字输入文本框

        var inputElem = $(obj[index].elem); // 输入框所在结点的class或id
        var searchURL = obj[index].searchURL; // 后端查询地址
        var valueField = obj[index].valueField? obj[index].valueField : 'id'; // 后端返回的字段名称，用于绑定列表每行的data-id属性
        var textField = obj[index].textField;   // 生成列表的文本内容，可自定义
        var paramName = obj[index].paramName; // 传递给后端时，搜索参数字段的名称，默认为‘content’
        var onSelect = obj[index].onSelect; // 当选中列表时，绑定的事件
        var editMode = obj[index].editMode; // 是否允许编辑(当没有选中的时候，保持输入的内容)

        if(searchURL == null) return false; // “url地址”为空时，中断初始化

        // 动态创建结点
        inputElem.addClass("layui-input search-input");
        inputElem.wrap('<div class="search-box"></div>');
        inputElem.after('<ul class="search-list"></ul>');

        inputElem.on('compositionstart', function () {
            console.log('虚拟文本');
            selectFlag[index] = false;
        });

        inputElem.on('compositionend', function () {
            console.log('实际数据');
            selectFlag[index] = true;
        });

        fetch_data[index] = function (searchContent, listElem) {
            var searchParam;

            if (!searchContent) {
                console.log('值空跳出')
                return;
            }
            if (fetching_data[index]) {
                console.log('正在查询跳出')
                return;
            }
            fetching_data[index] = true;
            console.log('开始查询');

            if(paramName){
                searchParam = {}
                searchParam[paramName] = searchContent
            }else{
                searchParam = { content: searchContent }
            }

            $.ajax({
                url: typeof searchURL == 'function'? searchURL() : searchURL,
                data:  searchParam,
                type: 'GET',
                dataType: 'json',
                beforeSend: function () {
                    listElem.html('<p><i class="layui-icon layui-icon-loading layui-anim layui-anim-rotate layui-anim-loop"></i>搜索中...</p>');
                    listElem.show();
                },
                success: function (res) {
                    data = res.data;
                    var html = '';
                    var text ='';

                    if (data.length > 0) {
                        for (var key in data) {
                            text = typeof textField == 'function'?textField(data[key]): data[key][textField || 'value'];

                            html += '<li class="search-option" data-key="'+ key +'" data-value="' + data[key][valueField] + '">' + text + '</li>';
                        }
                    } else {
                        html = '<p><i class="layui-icon layui-icon-search"></i> 未找到合适选项</p>';
                    }
                    listElem.html(html);
                    listElem.show();
                },
                error: function () {
                    layer.msg('获取列表失败，请检查网络', { icon: 2 });
                },
                complete: function (ic) { //用闭包保存当前输入数
                    return function () {
                        fetching_data[index] = false;
                        if (ic < input_count[index]) {//说明在查询期间用户又有输入
                            fetch_data[index](searchContent, listElem);
                        }
                    }
                }(input_count[index])
            });
        }

        bindSelectInput[index] = function () {
            // 搜索数据
            inputElem.on('keyup', function (data) {
                var searchContent = $(this).val();
                var listElem = $(this).parent().find('.search-list');
                if (selectFlag[index]) {
                    input_count[index] += 1;
                    fetch_data[index](searchContent, listElem);
                }
            });

            // 失去焦点后的操作
            inputElem.on('blur', function (data) {
                $(this).parents('.search-box').find('.search-list').hide();
                if (!editMode){
	                //判断文本框的内容和选中的内容是否一致，即判断是从列表中选的还是自己乱输的
	                if ( $(this).attr('data-text') !== $(this).val()) {
	                    $(this).val( $(this).attr('data-text'));
	                }
                }
            });
        }
        bindSelectInput[index]();
    }
    // 点击列表选择后的操作
    $('body').on('mousedown', ' .search-option', function () {
        var inputElem = $(this).parents('.search-box').find('input');
        var listElem = $(this).parents('.search-box').find('.search-list');

        inputElem.attr('data-text', $(this).html());
        inputElem.attr('data-value', $(this).attr('data-value'));
        inputElem.val(inputElem.attr('data-text'));
        listElem.hide();

        // 执行传递过来的事件
        if(typeof onSelect == 'function'){
            var key = $(this).attr('data-key');
            onSelect(data[key]);
        }
    });
}