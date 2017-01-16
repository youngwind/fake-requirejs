define(['b'],function (b) {
    var hi = function () {
        console.log('hi');
    };

    b.goodbye();
    return {
        hi: hi
    }
});