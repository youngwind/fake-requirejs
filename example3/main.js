require(['a','b'], function (a, b) {
    a.hi();
    b.goodbye();
}, function () {
    console.error('Something wrong with the dependent modules.');
});
