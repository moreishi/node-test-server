var port = 8080;
var app = require('express')(port);
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

var sc = [];

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
  user: { id: String, name: String },
  message: String,
  coords: [Number],
  created_at: { type: Date, default: Date.now }
});

var conversation = mongoose.Schema({
  users: [{ id: String, name: String }],
  messages: [{
    user: String,
    name: { type: String, default: null },
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

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {

  Sessions.remove(function() {});
  Conversations.remove(function() {});

  // Initiate Socket
  io.on('connection', function(client) {

    console.log('client connected');
    console.log(sc);
    // client on message
    client.on('shout', function(data) {

      var coordinates = [];

      var shagit = new Shouts({
        user: { id: data.id, name: data.name },
        message: data.message,
        coords: data.coords,
        created_at: new Date()
      });

      shagit.save(function(err, shout) {

        if(err) console.log(err);

        Sessions.find({ session_id: client.id }, function(err, session) {

          console.log(session);

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

      sc.push({
        fb_id: data.fb_id,
        session_id: client.id,
        loc: data.loc,
        formatted_address: data.formatted_address
      });

      var session = new Sessions({
        fb_id: data.fb_id,
        session_id: client.id,
        loc: data.loc,
        formatted_address: data.formatted_address
      });

      session.save(function(err, res) {
        console.log(res);
        console.log(sc);
      });

    });

    // on disconnect
    client.on('disconnect', function() {

      Sessions.remove({ session_id: this.id }, function(err, res) {
        console.log('Session terminated: ' + res);
        sc.map(function(val,key,arr) {
          if(client.id == val.session_id) sc.splice(key,1);
          console.log(sc);
        })
      });

    });

    app.get('/conversations/:uid',function(req,res,err) {

      Conversations.find({}, function(err, resa) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(resa));
      });
      
    });

    app.post('/conversations/update', function(req,res,next) {

        try {

          res.setHeader('Content-Type', 'application/json');

          var thread = req.param('thread');
          var message = req.param('message');
          var uname =  req.param('uname');
          var uid = req.param('uid');

          Conversations.find({ _id: thread }, function(err, find) {
            
            if(err) next(err);

            if(find.length) {
              Conversations.update({ _id: thread }, 
                { $push: { messages: { user:uid, name:uname, message:message } } },
                function(err, update) {

                  var users = find[0].users;

                  var emit_msg = { 
                    status: 'update', 
                    msg: { 
                      to: thread, 
                      message: { 
                        name: uname,
                        user: uid,
                        message:message,
                        created_at:Date.now()
                      }
                    }
                  };

                  users.map(function(val) {
                    sc.map(function(v,k) {
                      if(val.id === v.fb_id) {
                        io.to(v.session_id).emit('private message', emit_msg);
                        console.log(v.session_id);
                        console.log('emitting...');
                      }
                        
                    })
                  });

                  res.end(JSON.stringify({status: true}));
              });
            }

            res.end(JSON.stringify({status: false}));

          });         

        }
        catch(e) {
          console.log(e);
        }

    });

    app.post('/conversations', function(req, res, next) {

      res.setHeader('Content-Type', 'application/json');

      var from = String(req.param('from'));
      var to = String(req.param('to'));
      var message = String(req.param('message'));
      var name = String(req.param('name'));
      var tname = String(req.param('tname'));

      Conversations.find({ $and: [{'users.id': from},{'users.id': to}] }, function(err, find) {

        var http_res = null;

        if(find.length === 0) {
          new Conversations({
            users: [{id: from, name: name}, {id:to,name:tname}],
            messages: [{
              user: from,
              name: name,
              message: message
            }]
          }).save(function(err, save) {
            res.end(JSON.stringify({ status: 'sent', msg: save}));

            Sessions.find({ fb_id: to }, function(err, session) {
              
              session.map(function(val, key, arr) {
                console.log(val.session_id)
                io.to(val.session_id).emit('private message', { status: 'new', msg: save});
              });
              
            });

          })
        }

        if(find.length > 0) {

          Conversations.update({ $and: [{'users.id': from},{'users.id': to}] }, {
            $push: { messages: { user: from, message: message, name: name } }
          }, function(err, update) {
            
            res.end(JSON.stringify({status: 'sent', msg: null}));

            Sessions.find({ fb_id: to }, function(err, session) {
              
              find.map(function(val, key, arr) {

                session.map(function(vala, keya, arra) {
                  console.log(vala.session_id)
                  io.to(vala.session_id).emit('private message', {status: 'update', msg: {to: val._id, message: {name:name,user:from,message:message,created_at:Date.now()}}});
                });

              })

              
              
            });
            
          });
        }

      });

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