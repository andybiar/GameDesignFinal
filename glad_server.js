var sys = require('sys'),
    express = require('express'),
	http = require('http'),
	app = express(),
    server = http.createServer(app),
    io = require('socket.io').listen(server, {log: false}),
    fs = require('fs'),
    json = JSON.stringify,
    util = require('util'),
    connect = require('express/node_modules/connect'),
    parseCookie = connect.utils.parseCookie,
    MemoryStore = connect.middleware.session.MemoryStore,
    store;

app.configure(function () {
  app.use(express.cookieParser());
  app.use(express.session({
      secret: 'secret'
    , key: 'express.sid'
    , store: store = new MemoryStore()
  }));
});

app.get('/', function (req, res) {
  res.sendfile( __dirname + '/game.html');
});

app.get('/*.js', function(req, res){
	res.sendfile( __dirname + req.url);
});

app.get('/*.css', function(req, res){
	res.sendfile( __dirname + req.url);
});

app.get('/*.png', function(req, res){
	res.sendfile( __dirname + req.url);
});

app.get('/*.mp3', function(req, res){
	res.sendfile( __dirname + req.url);
});

var sids = new Array();
var users = new Array();
var kicked = new Array();
var accepted_actions = ['move', 'speak', 'conn', 'info', 'thekick', 'theban', 'attemptKill'];
var names = ["Red", "Blue", "Prince", "Michael"];
var voting = false;
var yesCount = 0;
var noCount = 0;
var accused = "";
var killerID = -1;
var livingPlayers = 0;

var currentTime;
var WORLD_W = 800,
    WORLD_Y = 500,
	USER_CAP = 4,
	USER_RADIUS = 20;

server.listen(8080);

io.configure('production', function(){
    io.set('log level', 1);
    io.set('transports', ['websocket']);
});


io.sockets.on('connection', function(socket){
    socket.ip = socket.handshake.address.address;
    socket.on('message', function(message){
        if (kicked.indexOf(socket.ip) != -1) {
            socket._onDisconnect();
            return false;
        }

        try {
            request = JSON.parse(message.replace('<', '&lt;').replace('>', '&gt;'));
        } catch (SyntaxError) {
            console.log('Invalid JSON:');
            console.log(message);
            return false;
        }

        request.id = socket.id;

        if(accepted_actions.indexOf(request.action) == -1) {
            console.log('Invalid request:' + "\n" + message);
            return false;
        }

        if(request.action == 'conn') {
            request.name = names[sids.length % names.length];
			
			// connect the new client to everyone who connected before
            for(i in sids){
                var s = sids[i];
                socket.send(json({
                    action:'conn',
                    id: s,
                    name:users[s].name,
                    x: users[s].x,
                    y: users[s].y,
					alive: true
                }));
            }

			// update the new client on his own state
            socket.send(json({
                    action:'me',
                    id: socket.id,
                    name: request.name,
					alive: true
            }));

            var access = fs.createWriteStream('access.log', {flags:'a'});
            currentTime = new Date();
            access.write("[" + currentTime.toUTCString() + "] " + request.name + " (SID: " + socket.id + " IP: " + socket.ip +") connected.\n");

            sids.push(socket.id);
            users[socket.id] = {name:request.name, ip:socket.ip, x:request.x, y:request.y, voted:false, alive:true,
								id:socket.id};
			
			// IF WE REACH THE CAP, SELECT THE KILLER
			if (sids.length === USER_CAP) {
				livingPlayers = USER_CAP;
				killerID = sids[Math.floor(Math.random() * USER_CAP)];
				io.sockets.send(json({
					action:'killer_select',
					killer: killerID
				}));
			}
        } else if (sids.indexOf(socket.id) == -1) {
            return false;
        }

        if(request.action == 'move') {
            if ( request.x < 0 || request.x > WORLD_W || request.y < 0 || request.y > WORLD_Y) return false;
            if(users[socket.id])
            {
                users[socket.id].x = request.x;
                users[socket.id].y = request.y;
            }
        }

		function isTwoWords(commandWords, feedback, badFormat) {
			if (commandWords.length != 2) {
				feedback.chat = badFormat;
				socket.send(json(feedback));
				return false;
			}
			return true;
		}
		
		function doForAllUsers(foo) {
			for (i in sids) {
				s = sids[i];
				foo(users[s]);
			}
		}
		
		function testForAnyUser(foo) {
			for (i in sids) {
				s = sids[i];
				if (foo(users[s]) === true) { return {val:true, id:s }; }
			}
			return { val:false, id:-1 };
		}
		
		function matchName(inName) {
			return testForAnyUser((function (user){ return user.name === inName; }));
		}
		
		function soloChat(feedback, msg) {
			feedback.chat = msg;
			socket.send(json(feedback));
			return;
		}
		
		function visibleChat(feedback, msg) {
			feedback.chat = msg;
			io.sockets.send(json(feedback));
			return;
		}
		
		function endVoting() {
			if (yesCount > noCount) { 
				livingPlayers--;
				io.sockets.send(json({action:'kill', id:accused})); 
			}
			else { console.log("NO WINS"); }
			doForAllUsers((function (user) { user.voted = false; }));
			yesCount = 0;
			noCount = 0;
			voting = false;
			accused = "";
		}
		
		function processCommand(request) {
			if(!users[socket.id].alive) return;
			var commandWords = request.chat.split(" ");
			var feedback = {action:'speak', chat:'', id:request.id};
			if (commandWords.length > 0 && commandWords[0] == "/accuse") {
				// ACCUSE COMMAND
				var format = isTwoWords(commandWords, feedback, "Did not understand accuse command");
				if (format === false) return;
				
				var nameMatch = matchName(commandWords[1]);
				if (nameMatch.val === true && voting === false) {
					accused = nameMatch.id;
					visibleChat(feedback, "I accuse " + commandWords[1] + "!");
					yesCount++;
					users[socket.id].voted = true;
					voting = true;
					return;
				}
				else {
					soloChat(feedback, "Accused a player who does not exist. lol.");
					return;
				}
			}
			else if (commandWords.length > 0 && commandWords[0] == "/vote") {
				// VOTE COMMAND
				if (voting === false) {
					soloChat(feedback, "No vote is being conducted right now");
					return;
				}
				var format = isTwoWords(commandWords, feedback, "Did not understand vote command");
				if (format === false) return;
				
				if (users[socket.id].voted === true) { soloChat(feedback, "You already voted"); return; }
				
				if (commandWords[1].toLowerCase() == "yes") {
					console.log("Yes vote recorded");
					yesCount++;
					users[socket.id].voted = true;
					if (yesCount + noCount === livingPlayers) endVoting();
				}
				else if (commandWords[1].toLowerCase() == "no") {
					console.log("No vote recorded. Like he voted no.");
					noCount++;
					users[socket.id].voted = true;
					if (yesCount + noCount === livingPlayers) endVoting();
				}
				else {
					soloChat(feedback, "You can only vote yes or no");
					return;
				}
			}
		}
			
        if(request.action == 'speak') {
            var chatlog = fs.createWriteStream('chat.log', {flags:'a'});
            currentTime = new Date();
            chatlog.write("[" + currentTime.toUTCString() + "] " + users[socket.id].name + ": " + request.chat +"\n");
            request.chat = request.chat.substring(0,140);
			
			// DETERMINE IF A COMMAND IS USED
			if (request.chat.length >= 1 && request.chat.charAt(0) === '/') {
				processCommand(request);
			}
			else {
				io.sockets.send(json(request));
			}
            return true;
        }
		
		if (request.action == 'attemptKill') {
			if (killerID === -1) return;
			var kx = users[killerID].x;
			var ky = users[killerID].y;
			var victim = testForAnyUser((function(user){ return (
														 user.id != socket.id &&
														 user.x > (kx - USER_RADIUS) &&
														 user.x < (kx + USER_RADIUS) &&
														 user.y > (ky - USER_RADIUS) &&
														 user.y < (ky + USER_RADIUS))}));
			if (victim.val === false) return;
			livingPlayers--;
			io.sockets.send(json({action:'kill', id:victim.id}));
		}

        if(request.action == 'info') {
            console.log("\nINFO\n");
            console.log("Total clients: " + sids.length);
            console.log("Kicked: " + kicked);
            console.log("");
            for (i in sids){
                s = sids[i];
                console.log("sid: " + s);
                console.log("ip: " + users[s].ip);
                console.log("name: " + users[s].name);
                console.log("color: " + users[s].color);
                console.log("pos: " + users[s].x + ", " + users[s].y);
                console.log("");
            }
        }

        if(request.action == 'thekick' || request.action == 'theban') {
            kicked.push(request.ip);
            console.log(request.action + ": " + request.ip);
            if (request.action == 'thekick') {
                var ip = request.ip;
                var duration = parseInt(request.duration);
                var unkick = function(){
                        return (function(){
                            delete kicked[kicked.indexOf(ip)];
                            console.log(kicked);
                            console.log("unkicked: " + ip);
                            console.log("time served: " + duration+"ms");
                        });
                };
                setTimeout(unkick(), duration);
            }
            return false;
        }
    
        socket.broadcast.send(json(request));
    });

    socket.on('disconnect', function(){
        io.sockets.send(json({'id': socket.id, 'action': 'close'}));

        if (sids.indexOf(socket.id) != -1) {
            currentTime = new Date();
            var access = fs.createWriteStream('access.log', {flags:'a'});
            access.write("[" + currentTime.toUTCString() + "] " + users[socket.id].name + " (SID: " + socket.id + " IP: " + socket.ip +") disconnected.\n");
            sids.splice(sids.indexOf(socket.id),1);
            delete users[socket.id];
        } else {
            console.log("on dc, cannot find: " + socket.id);
        }
    });
});
