define(['c'], function (c) {
    var goodbye = function () {
        console.log('goodbye');
    };

    c.show();

    return {
        goodbye: goodbye
    }
});