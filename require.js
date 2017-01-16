/**
 * Created by youngwind on 2016/12/12.
 */

let require, define;
(function (global) {
    if (global !== window) {
        console.error('当前环境非浏览器环境。');
        return;
    }
    let mid = 0;                // 模块id
    let tid = 0;                // 任务id
    let modules = {};           // 模块列表集合
    let tasks = {};
    let mapDepToModuleOrTask = {};    // 依赖→模块映射map

    window.modules = modules;           // 调试语句
    window.tasks = tasks;
    window.mapDepToModuleOrTask = mapDepToModuleOrTask;  // 调试语句

    /**
     * 入口文件的函数
     * @param dep {Array} 依赖模块数组(可省略)
     * @param cb {Function} 成功回调函数
     * @param errorFn {Function} 失败回调函数(可省略)
     */
    require = function (dep, cb, errorFn) {
        // 缺省参数处理
        if (isFunction(dep)) {
            cb = dep;
            dep = undefined;
        }
        let task = new Task(dep, cb, errorFn);
        task.analyzeDep();
    };


    /**
     * 定义一个模块
     * @param name {String} 模块名称(可省略)
     * @param dep {Array} 依赖模块数组(可省略)
     * @param cb {Function} 成功回调函数, 必须带return
     * @param errorFn {Function} 失败回调函数(可省略)
     */
    define = function (name, dep, cb, errorFn) {
        // 缺省参数处理
        if (isFunction(name)) {
            // 只有传了回调
            cb = name;
            name = getCurrentModuleName();
        } else if (Array.isArray(name) && isFunction(dep)) {
            // 传了依赖和回调
            cb = dep;
            dep = name;
            name = getCurrentModuleName();
        } else if (isString(name) && Array.isArray(name) && isFunction(cb)) {
            // 传了名字,依赖和回调
        }

        let module = modules[name];
        module.name = name;
        module.dep = dep;
        module.cb = cb;
        module.errorFn = errorFn;
        module.analyzeDep();
    };

    // 模块状态的定义
    Module.STATUS = {
        INITED: 1,      // 初始化完成
        FETCHING: 2,    // 正在网络请求
        FETCHED: 3,     // 网络请求结束(此状态暂时用不到)
        EXECUTING: 4,   // 准备开始运算模块
        EXECUTED: 5,    // 模块运算完毕
        ERROR: 6        // 模块发生错误
    };

    /**
     * 模块对象的构造函数
     * @param name {String} 模块名
     * @param dep {Array} 模块依赖
     * @param cb {Function} 成功回调函数
     * @param errorFn {Function} 失败回调函数
     * @constructor
     */
    function Module(name, dep, cb, errorFn) {
        this.mid = ++mid;
        this.init(name, dep, cb, errorFn);
        this.fetch();
    }

    /**
     * 模块初始化
     * @param name {String} 模块名
     * @param dep {Array} 模块依赖
     * @param cb {Function} 成功回调函数
     * @param errorFn {Function} 失败回调函数
     */
    Module.prototype.init = function (name, dep, cb, errorFn) {
        this.name = name;
        this.src = moduleNameToModulePath(name);
        this.dep = dep;
        this.cb = cb;
        this.errorFn = errorFn;
        this.callHook('INITED');
    };

    /**
     * 启动fetch任务
     */
    Module.prototype.fetch = function () {
        let scriptNode = document.createElement('script');
        scriptNode.type = 'text/javascript';
        scriptNode.src = this.src;
        scriptNode.onerror = this.fetchFail.bind(this);
        document.body.appendChild(scriptNode);
        this.callHook('FETCHING');
    };

    /**
     * 模块获取失败
     */
    Module.prototype.fetchFail = function () {
        console.error(`模块${this.name}获取失败, url为${this.src}`);
        this.callHook('ERROR');
    };

    /**
     * 分析模块的依赖
     * 1. 计算模块依赖的数量:depCount
     * 2. 生成依赖→模块映射表: mapDepToModuleOrTask
     */
    Module.prototype.analyzeDep = function () {
        let depCount = this.dep ? this.dep.length : 0;

        // 处理dep中包含'require'的特殊情况
        let requireInDep = (this.dep || []).indexOf('require');
        if (requireInDep !== -1) {
            depCount--;
            this.requireInDep = requireInDep;
            this.dep.splice(requireInDep, 1);
        }

        // 处理循环依赖情况
        let cycleArray = this.checkCycle();
        if (cycleArray) {
            depCount = depCount - cycleArray.length;
        }

        if (depCount === 0) {
            this.execute();
            return;
        }

        Object.defineProperty(this, 'depCount', {
            get() {
                return depCount;
            },
            set(newDepCount) {
                depCount = newDepCount;
                if (newDepCount === 0) {
                    if (this.mid) {
                        console.log(`模块${this.name}的依赖已经全部准备好`);
                    } else if (this.tid) {
                        console.log(`任务${this.tid}的依赖已经全部准备好`);
                    }
                    this.execute();
                }
            }
        });
        this.depCount = depCount;

        if (!this.depCount) return;

        this.dep.forEach((depModuleName) => {
            if (!modules[depModuleName]) {
                let module = new Module(depModuleName);
                modules[module.name] = module;
            }

            if (!mapDepToModuleOrTask[depModuleName]) {
                mapDepToModuleOrTask[depModuleName] = [];
            }
            mapDepToModuleOrTask[depModuleName].push(this);
        });
    };

    /**
     * 检查模块循环依赖
     * @returns {Array|undefined} 如果模块出现循环依赖的话,返回循环依赖的模块(以数组形式)
     */
    Module.prototype.checkCycle = function () {
        let cycleDep = [];
        for (let depModuleName of (this.dep || [])) {
            if (mapDepToModuleOrTask[this.name] && mapDepToModuleOrTask[this.name].indexOf(modules[depModuleName]) !== -1) {
                cycleDep.push(depModuleName);
            }
        }
        return cycleDep.length ? cycleDep : undefined;
    };

    /**
     * 运算模块
     */
    Module.prototype.execute = function () {
        this.callHook('EXECUTING');
        // 根据依赖数组向依赖模块收集exports当做参数
        let arg = (this.dep || []).map((dep) => {
            return modules[dep].exports;
        });

        // 插入require到回调函数的参数列表中
        if (this.requireInDep !== -1 && this.requireInDep !== undefined) {
            arg.splice(this.requireInDep, 0, require);
        }

        this.exports = this.cb.apply(this, arg);
        this.callHook('EXECUTED');
        if (this.tid) {
            console.log(`任务${this.tid}执行完成`);
        } else if (this.mid) {
            console.log(`模块${this.name}执行完成`);
        }
    };


    /**
     * 状态机:触发模块的状态转移
     * 当该模块处于运算完成状态时, 查找依赖→模块映射表, 修改相应的模块的depCount
     * @param mStatus {String} 模块的状态
     */
    Module.prototype.callHook = function (mStatus) {
        let status = Module.STATUS[mStatus];
        if (!this.status) {
            Object.defineProperty(this, 'status', {
                get () {
                    return status;
                },
                set (newStatus) {
                    status = newStatus;
                    if (status === 5) {
                        // 该模块已经executed
                        let depedModules = mapDepToModuleOrTask[this.name];
                        if (!depedModules) return;
                        depedModules.forEach((module) => {
                            setTimeout(() => {
                                module.depCount--;
                            });
                        });
                    }
                }
            })
        } else {
            this.status = status;
        }
    };

    /**
     * 任务构造函数
     * 任务是与模块不一样的概念。每调用一次require函数,相当于新建一个任务
     * 而任务与模块又有类似的地方,所以我让任务继承模块
     * @param dep {Array} 依赖数组
     * @param cb {Function} 成功回调函数
     * @param errorFn {Function} 失败回调函数
     * @constructor
     */
    function Task(dep, cb, errorFn) {
        this.tid = ++tid;
        this.init(dep, cb, errorFn);
    }

    Task.prototype = Object.create(Module.prototype);

    /**
     * 初始化任务
     * @param dep {Array} 依赖数组
     * @param cb {Function} 成功回调函数
     * @param errorFn {Function} 失败回调函数
     */
    Task.prototype.init = function (dep, cb, errorFn) {
        this.dep = dep;
        this.cb = cb;
        this.errorFn = errorFn;
        tasks[this.tid] = this;
    };


    // 启动主入口加载流程
    let mainEntryModule = new Module(getMainEntryModuleName());
    modules[mainEntryModule.name] = mainEntryModule;

    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////下面是工具类函数/////////////////////////////////////

    /**
     * 获取主入口模块的模块名
     * @returns {String} 主入口模块名
     */
    function getMainEntryModuleName() {
        let dataMain = document.currentScript.getAttribute('data-main');
        return modulePathToModuleName(dataMain);
    }

    /**
     * 获取当前正在执行的模块的模块名
     * @returns {String}
     */
    function getCurrentModuleName() {
        let src = document.currentScript.getAttribute('src');
        return modulePathToModuleName(src);
    }

    /**
     * 将模块的路径装换成模块名
     * @param path {String} 模块路径
     * @returns {String} 模块名
     */
    function modulePathToModuleName(path) {
        let reg = /\w*.js/;
        let output = reg.exec(path);
        if (!output) {
            return path;
        } else {
            return output[0].split('.')[0];
        }
    }

    /**
     * 将模块名转换成模块路径
     * @param name {String} 模块名
     * @returns {String} 模块路径
     */
    function moduleNameToModulePath(name) {
        let reg = /\w*.js/;
        let output = reg.exec(name);
        if (!output) {
            return `./${name}.js`;
        } else {
            return name;
        }
    }

    function isFunction(fn) {
        return typeof fn === 'function';
    }

    function isString(str) {
        return typeof str === 'string';
    }

})(this);