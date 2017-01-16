// 演示requirejs是如何处理循环依赖的
define(['require', 'a'], function (require) {
    var goodbye = function () {
        console.log('goodbye');
    };

    require(['a'], function (a) {
        a.hi();
    });

    return {
        goodbye: goodbye
    }
});