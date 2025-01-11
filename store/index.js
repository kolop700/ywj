// 拿到modules下的所有文件
const modulesFiles = import.meta.glob('./modules/*.*', { eager: true });
const modules = {};
for (const key in modulesFiles) {
    const moduleName = key.replace(/(.*\/)*([^.]+).*/gi, '$2');
    const value = modulesFiles[key];
    if (value.default) {
        modules[moduleName] = value.default;
    } else {
        modules[moduleName] = value;
    }
}

export default modules;