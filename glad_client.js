////////////////////////////////////////////////////////
// GLOBAL VARIABLES
////////////////////////////////////////////////////////
var socket;

var char_img0 = new Image();
var char_img1 = new Image();
var char_img2 = new Image();
var char_img3 = new Image();

var collide_snd = new Audio("sound/collideWall.mp3");
var stepCount = 0;

char_img0.src = '/images/char0.png';
char_img1.src = '/images/char1.png';
char_img2.src = '/images/char2.png';
char_img3.src = '/images/char3.png';

var filterStrength = 20,
    frameTime = 0, 
    lastLoop = new Date, thisLoop = 0;

var general = {
    DEBUG: false,
    HOST_URI: 'http://localhost:8080',
    CONN_OPTIONS: {'transports':['websocket']},
    FRAME_INTERVAL: 16,
    WORLD_H: 500,
    WORLD_W: 800,
    CHAT_DURATION: 8000,
    CHAT_WIDTH: 250,
    USER_RADIUS: 20,
    retrying: false,
};

var control = {
    rightDown: false,
    leftDown: false,
    upDown: false,
    downDown: false,
    typing: false
};

var canvas = {
    obj: undefined,
    width: 640,
    height: 480,
    offset_x:0,
    offset_y:0
};

var physics = {
    restitution: 0.6,
    xvel: 0,
    yvel: 0,
	speed: 6
};

var me = {};
var ids = new Array();
var users = new Array();
var context;
var img = new Image();

function onResize() {
    canvas.width = canvas.obj.width = window.innerWidth;
    canvas.height = canvas.obj.height = window.innerHeight;
    me.x = canvas.width/2;
    me.y = canvas.height/2;

    msgbox = $(".message");
    msgbox.css("left", (canvas.width - msgbox.width())/2 + "px");
    $("#prompt").css("left", (canvas.width - $("#prompt").width())/2 + "px");
    if (canvas.width <= 750) {
        $("#chatarea").width(.8 * canvas.width).css("margin-left", -0.4*canvas.width);
        $("#chatlog").width(.8 * canvas.width);
        $("#chatinput").width(.8 * canvas.width);
    }
}

function centerCamera() {
    var halfw = canvas.width/2,
        halfh = canvas.height/2;

    canvas.offset_x = me.world_x - halfw;
    canvas.offset_y = me.world_y - halfh;
}

$(window).resize(onResize);

function displayMessage(evt, msg) {
    msgbox = $('.message');
    msgbox[0].innerHTML = msg;
    msgbox.delay(500).show("fold",500).delay(5000).hide("fold",500);
}

////////////////////////////////////////////////////////
// KEYBOARD
////////////////////////////////////////////////////////
function onKeyDown(evt) {
    if (!control.typing) {
        if (evt.which == 39 || evt.which == 68) control.rightDown = true;
        if (evt.which == 37 || evt.which == 65) control.leftDown = true;
        if (evt.which == 38 || evt.which == 87) control.upDown = true;
        if (evt.which == 40 || evt.which == 83) control.downDown = true;
    }
}

function onKeyUp(evt) {
    if (!control.typing) {
        if (evt.which == 39 || evt.which == 68) control.rightDown = false;;
        if (evt.which == 37 || evt.which == 65) control.leftDown = false;;
        if (evt.which == 38 || evt.which == 87) control.upDown = false;;
        if (evt.which == 40 || evt.which == 83) control.downDown = false;;
    }
}

function onKeyPress(evt) {
	if (evt.which == 32 && me.killer === true) { attemptKill(); }
    if (control.typing) {
        if (evt.which == 13) sendchat();
    } else {
        if (evt.which ==13) {
            $(document).one("keyup", function(evt){
                if (evt.which == 13)
                    showchat();
            });
        }
        if (evt.which == 108) togglelog();
    }
}

//////////////////////////////////////////////////////////
// Mouse (in the house)
//////////////////////////////////////////////////////////
function getMousePos(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	var root = document.documentElement;
	
	var mouseX = evt.clientX - rect.top - root.scrollTop;
	var mouseY = evt.clientY - rect.left - root.scrollLeft;
	return{
		x: mouseX,
		y: mouseY
	};
}

function updateCursor() {
	context.beginPath();
	context.arc(me.mousePos.x,me.mousePos.y,2,0,2*Math.PI);
	context.fill();
}

function onMyClick(e) {
	//alert(me.mousePos.y + " - " + me.y + " is the height\n" + me.mousePos.x + " - " + me.x + " is the width\ntheta is " + me.theta);
	//alert("(" + Math.cos(me.theta) + ", " + Math.sin(me.theta) + ")");
}

//////////////////////////////////////////////////////////
// Movement
//////////////////////////////////////////////////////////
function move()
{
	var leftright = false;
	var updown = false;
	
	// X MOVEMENT
    if (control.rightDown && !control.leftDown) {
		physics.xvel = physics.speed;
		leftright = true;
		}
    else if (control.leftDown && !control.rightDown) {
		physics.xvel = - physics.speed;
		leftright = true;
		}
	else physics.xvel = 0;
	
	// Y MOVEMENT
    if (control.upDown && !control.downDown) {
		physics.yvel = - physics.speed;
		updown = true;
		}
    else if (control.downDown && ! control.upDown) {
		physics.yvel = physics.speed;
		updown = true;
		}
	else physics.yvel = 0;
	
	// REDUCE SPEED IF DIAGONAL
	if (leftright && updown) {
		physics.xvel *= (Math.sqrt(2) / 2);
		physics.yvel *= (Math.sqrt(2) / 2);
		}
		
	// MOVE PEEPS
	me.world_x += physics.xvel;
	me.world_y += physics.yvel;
		
	// DETECT MAP COLLISIONS
	if(newMap.testCollision(me.world_x,me.world_y)){
		me.world_x -= physics.xvel;
		me.world_y -= physics.yvel;
		collide_snd.play();
	}
	
    //SEND THAT SHITAKI TO THE SERVER
    socket.send(JSON.stringify({
        action:'move',
        x:me.world_x,
        y:me.world_y,
    }));
}

function othermove(data) {
    if (ids.indexOf(data.id) != -1) {
       users[data.id].world_x = data.x;
       users[data.id].world_y = data.y;
    } else {
        ids.push(data.id);
        users[data.id] = {
            world_x: data.x,
            world_y: data.y,
            name: ''
        };
        updateStatus();
    }
}

////////////////////////////////////////////////
// OTHER CONTROLS
////////////////////////////////////////////////
function attemptKill() {
	socket.send(JSON.stringify({
		action:'attemptKill'
	}));
}

////////////////////////////////////////////////
// Canvas remove/draw
////////////////////////////////////////////////
function otherremove(data)
{
    if (users[data.id].chattid)
        clearTimeout(users[data.id].chattid);
    delete users[data.id];
    var index = ids.indexOf(data.id);
    if (index != -1)
        ids.splice(ids.indexOf(data.id),1);
    updateStatus();
}

function otherconn(data) {
    var username = data.name.replace("&lt;", "<").replace("&gt;",">");
    var sid = data.id;
    if (ids.indexOf(sid) != -1) {
        users[sid].name = username;
        users[sid].world_x = data.x;
        users[sid].world_y = data.y;	
        users[sid].alive = data.alive;
    } else {
        ids.push(sid);
        users[sid] = {
            name: username,
            world_x: data.x,
            world_y: data.y,
            alive: data.alive
        };
        updateStatus();
    }
}

function otherdraw()
{
    for (var i in ids)
    {
        var user = users[ids[i]];

        context.fillStyle = user.color;
        context.strokeStyle = user.color;

        ux = user.x = user.world_x - canvas.offset_x;
        uy = user.y = user.world_y - canvas.offset_y;

		context.save();
		context.translate(ux, uy);
		if (user.alive) { context.drawImage(char_img3,-10,-20); }
		context.restore();

        context.font = "15px Orbitron"; 
        context.textAlign = "center";
        context.fillText(user.name, ux, uy+30);

        if (user.chat && user.alive) displaychat(user);
    }
}

function draw()
{
    context.lineWidth = 4;

    context.clearRect(0,0,canvas.width,canvas.height);

    // calculate position
    centerCamera();
    move();
	updateCursor();

    var start_x = canvas.offset_x > 0 ? 0 : -1 * canvas.offset_x,
        start_y = canvas.offset_y > 0 ? 0 : -1 * canvas.offset_y,
        end_x = canvas.offset_x + canvas.width > img.width ? canvas.width - (canvas.offset_x + canvas.width - general.WORLD_W) : canvas.width,
        end_y = canvas.offset_y + canvas.height > img.height ? canvas.height - (canvas.offset_y + canvas.height - general.WORLD_H) : canvas.height;

    context.strokeStyle = "#333333";
	context.fillStyle = "#FFFFFF";
    context.beginPath();

    if(canvas.offset_x < 0) {
        context.moveTo(start_x,start_y);
        context.lineTo(start_x,end_y);
    } 
    if (canvas.offset_x + canvas.width > general.WORLD_W) {
        context.moveTo(end_x,start_y);
        context.lineTo(end_x,end_y);
    }
    if(canvas.offset_y < 0) {
        context.moveTo(start_x,start_y);
        context.lineTo(end_x,start_y);
    } 
    if (canvas.offset_y + canvas.height > general.WORLD_H) {
        context.moveTo(start_x,end_y);
        context.lineTo(end_x,end_y);
    }
	newMap.drawMap(-canvas.offset_x,-canvas.offset_y);
    context.stroke();
        
    otherdraw();

    // draw user
    context.fillStyle = me.color;

	context.save();
	context.translate(canvas.width/2, canvas.height/2);
	if (me.alive) { context.drawImage(char_img3,-10,-20); }	
	context.restore();

    context.font = "20px Orbitron"; 
    context.textAlign = "center";
    context.fillText(me.name, canvas.width/2, canvas.height/2+35);
	
    if (me.chat && me.alive) displaychat(me);

    if(general.DEBUG) {
        var thisFrameTime = (thisLoop=new Date) - lastLoop;
        frameTime+= (thisFrameTime - frameTime) / filterStrength;
        lastLoop = thisLoop;
    }
}

///////////////////////////////////////////////////
// Networking
///////////////////////////////////////////////////
function updateStatus(){
    $('#numusers')[0].innerHTML = 'Users online: ' + (ids.length + 1);
}

function input(promptstring, func)
{
    $("body").append("<div id='prompt' style='top:40px;'>" + promptstring +" <br/><input type='text' name='input' maxlength='15'/><br/><p></p></div>");
    $("#prompt").css("left", (canvas.width - $("#prompt").width())/2 + "px");

    $("[name='input']").focus().keypress(function(evt){
        if (evt.which == 13) {
            var entered = $("[name='input']")[0].value;
            while(entered[entered.length-1] === " " || entered[entered.length-1] === "\n")
                entered = entered.substring(0,entered.length-1);
            if (entered)
                setTimeout(function(){func(entered); $("#prompt").remove();},0);
            else $("#prompt p")[0].innerHTML = "Invalid username."
        }
    });
}

function onconnect(name) {
    updateStatus();
    socket.send(JSON.stringify({
        action:'conn',
        name:name,
        x: me.world_x,
        y: me.world_y,
		alive: true
    }));
}

function onspeak(data) {
    var chat = data.chat.replace("&lt;", "<").replace("&gt;",">");
    if(data.id == me.id) {
        clearTimeout(me.chattid);
        me.chat = chat;
        me.chattid = setTimeout(function(){me.chat = '';}, general.CHAT_DURATION);
    } else if (users[data.id]) {
        clearTimeout(users[data.id].chattid);
        users[data.id]['chat'] = chat;
        users[data.id].chattid = setTimeout(function(){users[data.id]['chat'] = '';}, general.CHAT_DURATION);
    }
}

function killerselect(data) {
	if (data.killer == me.id) {
		$("#gamestate")[0].innerHTML = "You are the killer";
		$("#gamestate").show();
		me.killer = true;
	}
	else {
		console.log(me.name + ", not the killer");
	}
}

function kill(data) {
	if (data.id == me.id) { me.alive = false; }
	else { users[data.id].alive = false; }
}

function displaychat(speaker) {
    var wa=speaker.chat.replace("&lt;", "<").replace("&gt;",">").split(" "),
        phraseArray=[],
        lastPhrase="",
        measure=0,
        maxlength = 150;
    
    for (var i=0;i<wa.length;i++) {
        var w=wa[i];
        measure=context.measureText(lastPhrase+w).width;
        if (measure<general.CHAT_WIDTH) {
            lastPhrase+=(w+" ");
        }else {
            if(context.measureText(w).width > general.CHAT_WIDTH) {
                var wlen = context.measureText(w).width;
                var space = general.CHAT_WIDTH - context.measureText(lastPhrase + " ").width;
                var index = Math.floor(space/Math.ceil(wlen/w.length));
                phraseArray.push(w.substring(0,index));
                wa.splice(i+1,0,w.substring(index,w.length));
            } else {
                if (lastPhrase[lastPhrase.length-1] == " ")
                    lastPhrase = lastPhrase.substring(0,lastPhrase.length-1);
                phraseArray.push(lastPhrase);
                lastPhrase=w+" ";
            }
        }
        if (i===wa.length-1) {
            if (lastPhrase[lastPhrase.length-1] == " ")
                lastPhrase = lastPhrase.substring(0,lastPhrase.length-1);
            phraseArray.push(lastPhrase);
            break;
        }
    }

    context.font = "18px sans-serif"; 
    context.textAlign = "center";
    while(phraseArray.length > 0) {
        lastPhrase = phraseArray.splice(0,1);
        context.fillText(lastPhrase, speaker.x, speaker.y-25-(phraseArray.length*15));
    }
}

function showchat() {
    control.typing = true;
    $("#chatinput").css("visibility","visible").focus();
    onResize();
}

function sendchat() {
    control.typing = false;

    var entered = $("#chatinput")[0].value;
    while(entered[entered.length-1] === " " || entered[entered.length-1] === "\n")
        entered = entered.substring(0,entered.length-1);
    if ((!(entered === "")) && me.alive) {
        socket.send(JSON.stringify({
            action:'speak',
            chat: entered
        }));
    }
    $("#chatinput").css("visibility", "hidden").blur();
    $("#chatinput")[0].value = '';
}

//////////////////////////////////////////
// Looks like a constructor 
//////////////////////////////////////////
function init() {
    socket = io.connect(general.HOST_URI, general.CONN_OPTIONS);
    me.name = "";
    me.x = canvas.width/2;
    me.y = canvas.height/2;
    me.world_x = 300;
    me.world_y = 300;
	me.mousePos = {x:-20, y:-20};
	me.alive = true;
	me.killer = false;
	
	// so let's try to construct a cursor
	canvas.obj.addEventListener('mousemove', function(evt) {
		me.mousePos = getMousePos(canvas.obj, evt);
		}, false);
		
	canvas.obj.addEventListener('mousedown', onMyClick, false);

	// Server interaction
    if (navigator.userAgent.toLowerCase().indexOf('chrome') > -1  ) {
        $("#numusers")[0].innerHTML = "Connecting to server...";
        $("#numusers").show();
        if (socket) {
            general.retrying = setInterval("io.connect(general.HOST_URI, general.CONN_OPTIONS)",3000);
            socket.on('connect', function(){
                if(general.retrying){
                    clearTimeout(general.retrying);
                    general.retrying = false;
                }
                onconnect(me.name);
            });
            socket.on('message', function(data){
                data = JSON.parse(data);
                if (data.action == 'move') {
                    othermove(data);
                } else if (data.action == 'speak') {
                    onspeak(data);
                } else if (data.action == 'conn') {
                    otherconn(data);
                } else if (data.action == 'close') {
                    otherremove(data);
				} else if (data.action == 'killer_select') {
					killerselect(data);
                } else if (data.action == 'me') {
                    me.name = data.name.replace("&lt;", "<").replace("&gt;",">");
                    me.id = data.id;
					me.alive = data.alive;
                } else if (data.action == 'kill') {
					kill(data);
				}
            });
            socket.on('disconnect', function(){
                ids = new Array();
                users = new Array();
                me.name = "";
                $("#numusers")[0].innerHTML = "Disconnected!<br/>Trying to reconnect...";
                general.retrying = setInterval("io.connect(general.HOST_URI)", 3000);
            });
        }
    }
    if (general.DEBUG) {
        $(".debug").css("display", "inline");
        setInterval(function(){$("#fps")[0].innerHTML = "fps: " + (1000/frameTime).toFixed(1);}, 1000);
    }

    setInterval(draw, general.FRAME_INTERVAL);
    $(document).keydown(onKeyDown);
    $(document).keyup(onKeyUp);
    $(document).keypress(onKeyPress);
    $('#chatinput').focus(function(e){control.typing = true;});
    $('#chatinput').blur(function(e){control.typing = false;});
    $(".message").bind("custom", displayMessage);
    //$(".message").trigger("custom", ['Welcome to <br> URBAN GLADIATORS<br>']);
}

$(document).ready(function(){
    canvas.obj = $("#canvas")[0];
    context = canvas.obj.getContext("2d");
    if (navigator.userAgent.toLowerCase().indexOf('chrome') === -1  ) {
        $("body").append("<div class='error'>WARNING: This page was built for Chrome. Therefore, the page may be functional, but you will be unable to connect to the server.<br/>Please download Google Chrome.</div>");
    }
    onResize();
	init();
});
