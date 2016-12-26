# 项目说明
通过模仿[requirejs](https://github.com/requirejs/requirejs),学习如何写一个模块加载器。
用浏览器打开`example/index.html`可以直接查看demo

# 使用方法
## 引入fake-require.js文件
```html
<script src="../require.js" data-main="./main.js"></script>
```
`data-main`属性为指定的入口js文件。当`_fake-require.js`加载完之后,就会马上请求该入口文件。

## 编写入口文件main.js
```js
// main.js
require(['a', 'b'], function (a, b) {
    a.hi();
    b.goodbye();
}, function () {
    console.error('Something wrong with the dependent modules.');
});
```
require函数接受三个参数。

1. 第一个为依赖的模块数组
2. 第二个为依赖模块数组都加载成功后的回调函数,其中参数`a`,`b`对应相应的模块
3. 第三个为失败回调函数,任意一个依赖的模块失败都会触发此函数。

## 编写模块
```js
//a.js
define(function () {
    var hi = function () {
        console.log('hi');
    };

    return {
        hi: hi
    }
});
```

```js
// b.js
define(function () {
    var goodbye = function () {
        console.log('goodbye');
    };

    return {
        goodbye: goodbye
    }
});
```