// var apiKey = '589734896502';

// var GCMPush = require('gcm-push');
// var gcm = new GCMPush(apiKey);

// gcm.notifyDevice('OK', 'notification title', 'my message');

var express = require('express')
var app = express()

app.get('/:regid', function (req, res) {
  // req.query.regid;
  console.log(req.params.regid);
  res.send(JSON.stringify(req.params.regid));
})

var server = app.listen(1337, function () {

  var host = server.address().address
  var port = server.address().port

  console.log('Example app listening at http://%s:%s', host, port)

})