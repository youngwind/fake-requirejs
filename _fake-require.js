/**
 * Created by youngwind on 2016/11/17.
 * 模仿requirejs写一个模块加载器
 */


let require, define;
(function (global) {
    // 全局导出的模块
    let globalModules = {};
    // 模块ID
    let mid = 0;

    const IS_MAIN_ENTRY = true;

    // 模块的三种状态
    const RESOLVE = 'RESOLVE';  // 加载成功
    const REJECT = 'REJECT';    // 加载失败
    const PENDING = 'PENDING';  // 等待加载

    /**
     * 定义require函数
     * @param deps {Array} 依赖模块
     * @param callback {Function} 依赖模块都加载完之后的回调
     * @param errback {Function} 依赖模块任一一个出错,就会调用这个错误回调
     */
    require = (deps, callback, errback) => {
        if (!Array.isArray(deps)) {
            throw new Error('The first Argument of require must be an Array');
        }

        if (typeof callback !== 'function') {
            throw new Error('The second Argument of require must be a function');
        }

        if (errback && typeof errback !== 'function') {
            throw new Error('The third Argument of require must be a function');
        }

        // 加载各个依赖模块
        deps.forEach((depModuleName) => {
            loadModule(depModuleName);
        });
        moduleEvent.listen(JSON.parse(JSON.stringify(deps)), callback, errback);
    };

    define = (name, deps, callback) => {
        if (typeof name === 'function' && !deps && !callback) {
            // 只传callback
            callback = name;
            name = undefined;
            deps = undefined;
        } else if (typeof name === 'string' && typeof deps === 'function') {
            // 只传名字和callback
            callback = deps;
            deps = undefined;
        } else if (Array.isArray(name) && typeof deps === 'function') {
            // 只传依赖和callback
            callback = deps;
            deps = name;
            name = undefined;
        } else {
            throw new Error('The argument for define function is wrong.');
        }

        let src = getCurrentScriptSrc();
        if (!name) {
            name = getModuleNameFromSrc(src);
        }
        let module = {
            src,
            name,
            cb: callback,
            // exports: callback(),
            id: ++mid
        };
        globalModules[name] = module;

        if (deps) {
            // TODO 此处有问题, 因为deps可能已经准备好了,这时候listen还管用吗?
            // moduleEvent.listen(deps, callback);
            deps.forEach((dep) => {
               loadModule(dep);
            });
        } else {
            module.exports = callback();
        }

    };

    // 使用观察者模式监听各个模块的加载情况
    let moduleEvent = {
        /**
         * 存储各个模块组合所对应的成功和失败回调函数
         * 比如:
         * {
         *      'a&b': {
         *              successFns: [Fns],
         *              failFns: [Fns],
         *              done: true
         *            },
         *      'a&c':{
         *               successFns: [Fns],
         *               failFns: [Fns],
         *               done: true
         *            }
         * }
         */
        events: {},

        /** state字段将存储各模块的加载情况
         比如:
         {
            a: 'RESOLVE'
            b: 'PENDING'
            c: 'REJECT'
         }
         **/
        state: {},

        /**
         * 监听依赖模块的加载情况
         * 定义模块和入口文件的时候会用到
         * @param deps {Array} 依赖模块数组, 比如 ['a', 'b']
         * @param callback {Function} 依赖模块都成功加载之后执行的回调函数
         * @param errback {Function} 任一依赖模块加载失败之后执行的错误回调函数
         */
        listen (deps, callback, errback) {
            deps.forEach((dep) => {
                if (!this.state[dep]) {
                    this.state[dep] = PENDING;
                }
            });

            let modulesName = deps.join('&');   // -> 'a&b'
            if (!this.events[modulesName]) {
                this.events[modulesName] = {};
            }
            let modulesEvent = this.events[modulesName];

            // 将成功和失败回调函数分别注册
            (modulesEvent.successFns || (modulesEvent.successFns = [])).push(callback);
            if (!modulesEvent.failFns) {
                modulesEvent.failFns = [];
            }
            if (errback) {
                modulesEvent.failFns.push(errback);
            }
            modulesEvent.done = false;
        },

        /**
         * 触发单个模块的状态改变
         * @param moduleName {String} 模块名,比如 'a'
         * @param moduleState {String} 模块状态, 比如 RESOLVE OR REJECT OR PENDING
         */
        trigger (moduleName, moduleState){
            this.state[moduleName] = moduleState;
            this.triggerModulesState();
        },

        /**
         * 触发依赖模块集合的事件
         * 每次有模块状态改变都会调用这个事件
         */
        triggerModulesState (){
            for (let key in this.events) {
                let modules = this.events[key];

                // 如果此依赖模块集合的回调函数已经执行过了,那么直接忽略
                if (modules.done) continue;

                let res = judgeModulesState(key, this.state);
                if (res === RESOLVE) {
                    // 所有module都准备好了
                    let arg = [];
                    key.split('&').forEach((k) => {
                        arg.push(globalModules[k].exports);
                    });
                    modules.successFns.forEach((successFn) => {
                        successFn.apply(this, arg);
                    });
                    // 无论结果如何,都将完成位置置为true
                    modules.done = true;
                } else if (res === REJECT) {
                    // 有module失败了
                    modules.failFns.forEach((failFn) => {
                        failFn();
                    });
                    // 无论结果如何,都将完成位置置为true
                    modules.done = true;
                } else if (res === PENDING) {
                    // do nothing
                }
            }
        }
    };

    /**
     * 判断依赖模块组合的加载情况
     * 比如 ['a', 'b']两个模块
     * 1. 当两个模块都为resolve状态,整体才是resolve状态
     * 2. 当任意一个模块为reject状态,整体是reject状态
     * 3. 当任意一个模块时pending状态,整体是pending状态
     * 这部分的逻辑跟promise一模一样
     * @param key {String} 依赖模块组合,比如'a&b'
     * @param modules {Object} 各个模块的状态对象
     * @returns {*}
     */
    function judgeModulesState(key, modules) {
        for (let moduleName of key.split('&')) {
            if (modules[moduleName] === REJECT) {
                return REJECT;
            }
            if (modules[moduleName] === PENDING) {
                return PENDING;
            }
        }
        return RESOLVE;
    }

    /**
     * 加载模块
     * @param name {String} 模块的名字(默认名字就是文件名,且模块路径与入口文件同级)
     * @param isMainEntry {Boolean} true为main入口js文件,false为普通模块
     */
    function loadModule(moduleName, isMainEntry) {
        let scriptNode = document.createElement('script');
        scriptNode.type = 'text/javascript';
        moduleName = getModuleNameFromSrc(moduleName)
        scriptNode.src = `./${moduleName}.js`;
        scriptNode.onerror = () => {
            if (!isMainEntry) {
                moduleEvent.trigger(moduleName, REJECT);
            }
        };
        scriptNode.onload = () => {
            console.log(`The script ${moduleName}.js loaded.`);
            if (!isMainEntry) {
                moduleEvent.trigger(moduleName, RESOLVE);
            }
        };
        document.body.appendChild(scriptNode);
    }


    /**
     * 从给定的文件路径中解析出文件名
     * @param name {String} 比如 './main.js'
     * @returns {String} 比如 'main'
     */
    function getModuleNameFromSrc(name) {
        if (!name) {
            console.error('The argument of getModuleNameFromSrc can not be undefined');
            return;
        }
        let fileNameReg = /[^\\\/]*[\\\/]+/g;
        return name.replace(fileNameReg, '').split('.')[0]
    }

    /**
     * 获取当前执行js所在的script标签的src属性
     * @returns {string}
     */
    function getCurrentScriptSrc() {
        return document.currentScript.getAttribute('src');
    }

    /**
     * 加载主入口main.js文件
     */
    function loadMainEntryJS() {
        let scripts = document.getElementsByTagName('script');
        let requireScript = scripts[scripts.length - 1];
        let mainScript = requireScript.getAttribute('data-main');
        if (!mainScript) return;
        loadModule(mainScript, IS_MAIN_ENTRY);
    }

    loadMainEntryJS();

    // 测试用赋值
    global.globalModules = globalModules;
    global.moduleEvent = moduleEvent;

})(this);