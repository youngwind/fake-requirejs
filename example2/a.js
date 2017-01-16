/**
 * Created by youngwind on 2016/12/27.
 * 演示commonjs是如何处理循环依赖的
 */

exports.done = false;
let b = require('./b.js');
console.log(`在a.js之中, b.done = ${b.done}`);
exports.done = true;
console.log('a.js执行完毕');