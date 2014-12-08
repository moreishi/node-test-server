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

// SCHEMA
var session = mongoose.Schema({
  fb_id: String,
  session_id: String,
  loc: { type: [Number], index: true },
  formatted_address: { type: String, default: null },
  create_at: { type: Date, default: new Date() }
});

var shout = mongoose.Schema({
  user: { id: Number, name: String },
  message: String,
  coords: [Number],
  created_at: { type: Date, default: Date.now }
});

// var conversation = mongoose.Schema({
//   user: String,
//   sender: String,
//   message: String,
//   created_at: { type: Date, default: Date.now },
//   read: { type: Boolean, default: false }
// });

var conversation = mongoose.Schema({
  users: [String],
  messages: [{
    user: String,
    message: { type: String, default: 'No message to show' },
    created_at: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
  }],
  block: { type: Boolean, default: false }
});

// MODEL
var Sessions = mongoose.model('Sessions', session);
var Shouts = mongoose.model('Shouts', shout);
var Conversations = mongoose.model('Conversations', conversation);
// var Contacts = mongoose.model('Contacts', contact);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {

  Sessions.remove(function() {});
  // Initiate Socket
  io.on('connection', function(client) {

    console.log('client connected');

    // client on message
    client.on('shout', function(data) {

      var coordinates = [];

      console.log(data);

      var shagit = new Shouts({
        user: { id: data.id, name: data.name },
        message: data.message,
        coords: data.coords,
        created_at: new Date()
      });

      shagit.save(function(err, shout) {
        if(err) console.log(err);

        // find the receiver of ther message
        Sessions.find({ session_id: client.id }, function(err, session) {

          coordinates.push(session[0].loc[0]);
          coordinates.push(session[0].loc[1]);

          Sessions.find({ formatted_address: session[0].formatted_address }, function(err, _session) {
            if(err) console.log(err);
            _session.map(function(val, key){
              io.to(val.session_id).emit('shout', shout);
            });
          });

        });

      });      

    });

    // on facebook login
    client.on('fb login', function(data) {

      var session = new Sessions({
        fb_id: data.fb_id,
        session_id: client.id,
        loc: data.loc,
        formatted_address: data.formatted_address
      });

      session.save(function(err, res) {
        console.log(res);
      });

    });

    // on disconnect
    client.on('disconnect', function() {
      Sessions.remove({ session_id: this.id }, function(err, res) {
        console.log('Session terminated: ' + res);
      });
    });

    client.on('private message', function(message) {

      console.log(message);
      var to_user = message.to_user;
      var message = message.message;

      getModel(Sessions,{ session_id: client.id },function(res) {

        if(typeof res[0].fb_id === undefined) console.log('check your socket session');

        var current_user = res[0].fb_id;
        var users = [];
        users.push(to_user);
        users.push(current_user);

        var save_message = {
          user: current_user,
          message: message
        }

        var model_conversation = new Conversations({
          users: users,
          messages: [save_message]
        });

        model_conversation.save(function(err, data) {
          getModel(Sessions,{ fb_id: to_user },function(res) {
            console.log('saved');
            console.log(res);
            res.map(function(val,key,arr) {
              io.to(val.session_id).emit('private message', data);
            });
          });
        });

      });

    });

  });
  
  app.get('/',function(req,res,err) {   

    Contacts.find({ $and: [{users: '2222'},{users: '0000'},{users: '3333'}] }, function(err, data) {
      console.log(JSON.stringify(data));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    });
    
  });

  http.listen(port, function(){
    console.log('listening on *:' + port);
  });

});

// makes life easier

function getModel(model,options,callback) {
  model.find(options, function(err, res) {
    callback(res);
  });
}