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
var connected = 0;

function Task(text, x, y, width, height) {
	this.text = text;
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
}

tasks = new Array();
tasks[0] = new Task("Cook some Food", 210, 450, 310, 510);
tasks[1] = new Task("Tidy the Broom Closet", 1450, 1325, 1520, 1395);
tasks[2] = new Task("Clean the Bathroom", 225, 1085, 435, 1270);
tasks[3] = new Task("Sweep the Lobby", 490, 1750, 1045, 1980);
tasks[4] = new Task("Examine your Desk Papers", 1330, 280, 1475, 480);
tasks[5] = new Task("Listen to the Radio", 1110, 1110, 1410, 1510);
tasks[6] = new Task("Arrange the Bookshelf in the Study", 1080, 110, 1285, 160);
tasks[7] = new Task("Straighten the Hallway Rug", 710, 1085, 820, 1670);
tasks[8] = new Task("Set the Grandfather Clock", 910, 1120, 990, 1160);
tasks[9] = new Task("Set the Dining Room Table", 640, 430, 875, 890);
tasks[10] = new Task("Wash the Dishes", 390, 440, 500, 560);
tasks[11] = new Task("Clean the Lobby Windows", 550, 1960, 1000, 2000);
tasks[12] = new Task("Change the Radio Station", 1285, 1430, 1400, 1495);
tasks[13] = new Task("Admire Self in the Bathroom Mirror", 365, 1210, 455, 1285);
tasks[14] = new Task("Organize the Pantry", 35, 40, 285, 325);
tasks[15] = new Task("Straighten the Vase in the Dining Room", 925, 325, 985, 410);
tasks[16] = new Task("Hide in the Closet", 1450, 1325, 1520, 1395);
tasks[17] = new Task("Jump on your Parents' Bed", 230, 1430, 385, 1575);
tasks[18] = new Task("Eat a Snack", 80, 40, 210, 85);
tasks[19] = tasks[10];
tasks[20] = new Task("Sweep the Bedroom", 1045, 690, 1500, 995);
tasks[21] = tasks[5];
tasks[22] = tasks[18];
tasks[23] = new Task("Wash the Window in the Study", 1435, 270, 1500, 475);
tasks[24] = new Task("Stock the Pantry", 35, 40, 290, 320);
tasks[25] = new Task("Dust the Paintings", 515, 1715, 650, 1770);
tasks[26] = new Task("Straighten the Rug", 1080, 205, 1280, 425);
tasks[27] = new Task("Clean the Bathtub", 230, 1135, 310, 1255);
tasks[28] = new Task("Carve the Turkey", 25, 460, 235, 655);
tasks[29] = new Task("Arrange the Bookshelf", 935, 1435, 1150, 1525);
tasks[30] = new Task("Tidy Up your Desk", 1315, 275, 1460, 480);
tasks[31] = new Task("Open the Window", 1485, 800, 1515, 815);

var currentTime;
var WORLD_W = 1540,
    WORLD_Y = 2000,
	USER_CAP = 8,
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
			request.imgIndex = connected;
			connected += 1;
			
			// connect the new client to everyone who connected before
            for(i in sids){
                var s = sids[i];
                socket.send(json({
                    action:'conn',
                    id: s,
                    name:users[s].name,
                    x: users[s].x,
                    y: users[s].y,
					imgIndex: users[s].imgIndex,
					alive: users[s].alive,
					theta: users[s].theta
                }));
            }

			// update the new client on his own state
            socket.send(json({
                    action:'me',
                    id: socket.id,
                    name: request.name,
					imgIndex: request.imgIndex,
					alive: true,
					task: tasks[request.imgIndex * 4]
            }));

			// log the connection in our access.txt file
            var access = fs.createWriteStream('access.log', {flags:'a'});
            currentTime = new Date();
            access.write("[" + currentTime.toUTCString() + "] " + request.name + " (SID: " + socket.id + " IP: " + socket.ip +") connected.\n");

			// update the server's player count
            sids.push(socket.id);
            users[socket.id] = {name:request.name, ip:socket.ip, x:request.x, y:request.y, voted:false, alive:true,
								id:socket.id, imgIndex:request.imgIndex, theta:0};
			
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
				users[socket.id].theta = request.theta;
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
