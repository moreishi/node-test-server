var port = 8080;
var app = require('express')(port);
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

mongoose.connect('mongodb://127.0.0.1:27017/test-shouts');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.all('*', function(req, res, next){
  if (!req.get('Origin')) return next();
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
  if ('OPTIONS' == req.method) return res.status(200).end();
  next();
});

// SCHEME
var conversation = mongoose.Schema({
  users: [{ id: String}]
});

// MODEL

var conv = mongoose.model('CONV', conversation);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {

  conv.remove({}, function(err, rm) { console.log('removing sample data...'); });

  setTimeout(function() {

    new conv({
      users: [{id: '123'}, {id: '321'}]
    }).save(function(err, save) {
      console.log('saved');
    });

    new conv({
      users: [{id: '456'}, {id: '654'}]
    }).save(function(err, save) {
      console.log('saved');
    });

  }, 2000);

  setTimeout(function() {
    conv.find({ $or: [{'users.id':'123'},{'users.id':'654'}] }, function(err, d) {
      console.log(d)
      if(err) console.log(err)
    });
  }, 3000);  

});