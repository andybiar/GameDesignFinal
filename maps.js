function Map(width, height, cell_size, walls){
	this.width = width;
	this.height = height;
	this. cell_size = cell_size;
	this.walls = walls;
}

Map.prototype.drawMap = function(start_x, start_y){
	context.fillStyle = "#333333";
	context.strokeStyle = "#333333";
	for(var i = 0; i < this.walls.length; i++){
		for(var j = 0; j < this.walls[i].length; j++){
			if(this.walls[i][j] == true){
				context.fillRect(start_x+this.cell_size*i, start_y+this.cell_size*j, this.cell_size, this.cell_size);
			}
		}
	}
};

Map.prototype.testCollision = function(player_x, player_y){
	return ((this.walls[Math.floor(player_x/this.cell_size)][Math.floor((player_y-10)/this.cell_size)])
||(this.walls[Math.floor(player_x/this.cell_size)][Math.floor(player_y/this.cell_size)])
||(this.walls[Math.floor(player_x/this.cell_size)][Math.floor((player_y+10)/this.cell_size)])
||(this.walls[Math.floor((player_x-10)/this.cell_size)][Math.floor((player_y-10)/this.cell_size)])
||(this.walls[Math.floor((player_x-10)/this.cell_size)][Math.floor(player_y/this.cell_size)])
||(this.walls[Math.floor((player_x-10)/this.cell_size)][Math.floor((player_y+10)/this.cell_size)])
||(this.walls[Math.floor((player_x+10)/this.cell_size)][Math.floor((player_y-10)/this.cell_size)])
||(this.walls[Math.floor((player_x+10)/this.cell_size)][Math.floor(player_y/this.cell_size)])
||(this.walls[Math.floor((player_x+10)/this.cell_size)][Math.floor((player_y+10)/this.cell_size)]));
	
};

var test_walls = new Array(80);

for (var i = 0; i < 80; i++) {
    test_walls[i] = new Array(50);
  }

for (var i = 0; i < 80; i++) {
    test_walls[i][0]  = true;
	test_walls[i][49]  = true;
	}
	
for (var i = 0; i < 50; i++) {
	test_walls[0][i] = true;
	test_walls[79][i] = true;
  }

var newMap = new Map(800, 500, 10, test_walls);