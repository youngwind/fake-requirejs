/**
 * Created by youngwind on 2016/12/27.
 */

exports.done = false;
var a = require('./a.js');
console.log(`在b.js中,a.done=${a.done}`);
exports.done = true;
console.log('b.js执行完毕');