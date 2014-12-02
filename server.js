// var apiKey = '589734896502';

// var GCMPush = require('gcm-push');
// var gcm = new GCMPush(apiKey);

// gcm.notifyDevice('OK', 'notification title', 'my message');

var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill('8CxQDZgz9NFqkIZhSCrhuQ');
var express = require('express')
var app = express()

var bodyParser = require('body-parser');
var multer = require('multer'); 

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(multer()); // for parsing multipart/form-data

app.post('/regid', function (req, res) {
  console.log(req.param('regid'));
  res.send('post');
})

app.get('/:regid', function (req, res) {
  res.send('get');
})

var server = app.listen(1337, function () {

  var host = server.address().address
  var port = server.address().port

  console.log('Example app listening at http://%s:%s', host, port)

})