/**
 * Type Battle for Pokemon Showdown
 * Originally intended for use with Sparkychild's Bot
 * Code by Kant Ketchum
 *
 * Players are given X random types, and they reveal them one at a time
 * Whoever's type is supereffective against the other gets a point and those types are discarded
 * If none are supereffective, those types stay on the table and the players pick again
 * If a player has multiple types on the table, supereffectiveness is calculated per type and totalled
 */

'use strict';

exports.game = "typebattle";
exports.aliases = ["tpb"];

let startingTypeCount = 9;
let defaultTypeCount = 9;
let maxTypeCount = 18;
const normal = "Normal", fighting = "Fighting", flying = "Flying", poison = "Poison", ground = "Ground", rock = "Rock";
const bug = "Bug", ghost = "Ghost", steel = "Steel", fire = "Fire", water = "Water", grass = "Grass";
const electric = "Electric", psychic = "Psychic", ice = "Ice", dragon = "Dragon", dark = "Dark", fairy = "Fairy";
const wild = "WILD";
const typeNames = [normal, fighting, flying, poison, ground, rock, bug, ghost, steel, fire, water, grass, electric, psychic, ice, dragon, dark, fairy, wild];
const weaknesses = {
    Normal: [fighting],
    Fighting: [flying, psychic, fairy],
    Flying: [rock, electric, ice],
    Poison: [ground, psychic],
    Ground: [water, grass, ice],
    Rock: [fighting, ground, steel, water, grass],
    Bug: [flying, rock, fire],
    Ghost: [ghost, dark],
    Steel: [fighting, ground, fire],
    Fire: [ground, rock, water],
    Water: [grass, electric],
    Grass: [flying, poison, bug, fire, ice],
    Electric: [ground],
    Psychic: [bug, ghost, dark],
    Ice: [fighting, rock, steel, fire],
    Dragon: [ice, dragon, fairy],
    Dark: [fighting, fairy, bug],
    Fairy: [poison, steel]
};
const resistances = {
    Normal: [],
    Fighting: [rock, bug, dark],
    Flying: [fighting, bug, grass],
    Poison: [fighting, poison, bug, grass, fairy],
    Ground: [poison, rock],
    Rock: [normal, flying, poison, fire],
    Bug: [fighting, ground, grass],
    Ghost: [poison, bug],
    Steel: [normal, flying, rock, bug, steel, grass, psychic, ice, dragon, fairy],
    Fire: [bug, steel, fire, grass, ice, fairy],
    Water: [steel, fire, water, ice],
    Grass: [ground, water, grass, electric],
    Electric: [flying, steel, electric],
    Psychic: [fighting, psychic],
    Ice: [ice],
    Dragon: [fire, water, ice, electric],
    Dark: [dark, ghost],
    Fairy: [fighting, bug, dark]
};
const immunities = {
    Normal: [ghost],
    Fighting: [],
    Flying: [ground],
    Poison: [],
    Ground: [electric],
    Rock: [],
    Bug: [],
    Ghost: [normal, fighting],
    Steel: [poison],
    Fire: [],
    Water: [],
    Grass: [],
    Electric: [],
    Psychic: [],
    Ice: [],
    Dragon: [],
    Dark: [psychic],
    Fairy: [dragon]
}
let challenger = "";
let challenged = "";

class TypeBattleGame extends Rooms.botGame {
    constructor(room) {
        super(room);
        
        this.allowJoins = true;
        this.allowRenames = false;
        this.state = "signups";
        this.gameId = "typebattle";
        this.gameName = "Type Battle";
        this.answerCommand = "special";
        
        this.playerObject = TypeBattleGamePlayer;
        this.sendRoom(challenger + " has challenged " + challenged + " to a Type Battle! " + this.command("accept") + " to accept.");
        this.sendRoom("Rock-Paper-Scissors with Pokemon Types, and a twist!");
        this.sendRoom("PM Commands(" + this.command("pick <type>") + ")");
    }

    onInit(user) {
    	super.onJoin(user);
    }

    onAccept(user) {
    	if(this.state === "started") return false;
    	if (user.name !== challenged) {
    		this.sendRoom("You were not challenged!");
    		return;
    	}
    	this.sendRoom(user.name + " has accepted the challenge! Let the game begin!");
    	super.onJoin(user);
    	this.startGame();
    }

    onJoin(user) {
    	// do nothing!
    }

    onLeave(user) {
        // TODO have other player win
    }

    onStart () {
        // nothing!
    }

    command(cmd) {
        return "``" + this.room.commandCharacter[0] + cmd + "``";
    }
    
    shuffleDeck () {
        let deck = [];
        // start deck off with X of each type
        typeNames.forEach((v) =>{
        	let i = startingTypeCount;
            while (i > 0) {
            	deck.push(v);
            	i--;
            }
        });
        return this.deck = Tools.shuffle(deck);
    }
    
    startGame() {
    	this.state = "started";
    	this.shuffleDeck();

        // deal X cards for each player;
        let i = startingTypeCount;
        while (i > 0) {
          	this.userList.forEach((u) => {
            	this.giveCard(toId(u));
        	});
            i--;
        }
        this.sendRoom("Each player has been dealt " + startingTypeCount + " cards.");
        this.initRound();
    }

    initRound() {
    	this.resetRound();
    	this.sendRoom("Pick a type from the cards that you have remaining.");
    	this.userList.forEach((u) => {
        	let player = this.users[toId(u)];
        	if (player.table.length > 0) {
        		this.sendRoom(player.name + "'s table: " + player.table);
        	}
        	player.sendHand();
        });
    	this.timer = setTimeout(() => {
            this.userList.forEach((u) => {
            	let user = this.users[toId(u)];
            	if (!user.picked) {
            		this.eliminate(user.userid);
            		return;
            	}
            });
        }, 90000);
    }

    resetRound() {
    	clearTimeout(this.timer);
    	this.userList.forEach((u) => {
    		this.users[toId(u)].picked = false;
    	})
    }
    
    giveCard (userid) {
        let card = this.deck.shift();
        if (!this.deck.length) this.shuffleDeck();
        let player = this.users[userid];
        player.receiveCard(card);
    }
  
    onPick(user, type) {
    	let player = this.users[user.userid];
    	let success = player.attemptToPick(type);
    	if (success) {
    		this.sendRoom(user.name + " has picked a type!");
    		this.checkIfEveryonePicked();
    	}
    }

    checkIfEveryonePicked() {
    	let allPicked = true;
    	this.userList.forEach((u) => {
    		if (!this.users[toId(u)].picked) {
    			allPicked = false;
    		}
    	});
    	if (allPicked) {
    		this.allPicked();
    	}
    }

    allPicked() {
    	let p1 = this.users[this.userList[0]];
    	let p2 = this.users[this.userList[1]];
    	let p1points = this.calculatePoints(p1.name, p1.table, p2.table);
    	let p2points = this.calculatePoints(p2.name, p2.table, p1.table);
    	// if any player got points, clear hands
    	if (p1points > 0 || p2points > 0) {
    		this.sendRoom("Clearing table.");
    		p1.resetTable();
    		p2.resetTable();
    	} else if (p1.table.length > 2 || p2.table.length > 2) {
			this.sendRoom("Too many types on the table, clearing table.");
    		p1.resetTable();
    		p2.resetTable();
    	} else {
    		this.sendRoom("No one got any points! These types stay on the table!");
    	}
    	p1.points += p1points;
    	p2.points += p2points;
    	this.sendRoom("POINTS: " + p1.name + ": " + p1.points + ", " + p2.name + ": " + p2.points);
    	// if players have 0 cards, calculate winner
    	// otherwise start again
    	if (p1.hand.length === 0) {
    		this.calculateWinner();
    	} else {
    		this.initRound();
    	}
    }

    calculatePoints(name, myTable, enemyTable) {
    	let points = 0;
    	myTable.forEach((type) => {
    		let outputString = name + ": " + type + " vs " + enemyTable;
    		let effectiveness = 1;
    		enemyTable.forEach((enemyType) => {
    			if (immunities[enemyType].includes(type)) {
    				effectiveness = 0;
    			}
    			if (weaknesses[enemyType].includes(type)) {
    				effectiveness = effectiveness * 2;
    			}
    			if (resistances[enemyType].includes(type)) {
    				effectiveness = effectiveness / 2;
    			}
    		});
    		if (effectiveness > 1) {
				if (points === 0) {
    				points = effectiveness;
    			} else {
    				points = points * effectiveness;
    			}
    		}
    		outputString += " --- " + effectiveness + "x effective";
    		this.sendRoom(outputString);
    	});
    	points = points / 2;
    	this.sendRoom(name + " got " + points + " points!");
    	return points;
    }

    calculateWinner() {
    	let p1 = this.users[this.userList[0]];
    	let p2 = this.users[this.userList[1]];
    	if (p1.points > p2.points) {
    		this.onEnd(p1.name);
    	} else if (p2.points > p1.points) {
    		this.onEnd(p2.name);
    	} else {
    		this.onEnd(p1.name + " and " + p2.name);
    	}
    }
    
    onEnd (winnerName) {
        if (winnerName === undefined) {
            this.sendRoom("Game is over! Nobody wins!");
        } else {
            this.sendRoom("Game is over! Winner: " + winnerName);
        }
        this.destroy();
    }

    eliminate (userid) {
        var name = this.users[userid].name;
        //remove players
        delete this.users[userid];
        this.userList.splice(this.userList.indexOf(userid), 1);
        if (this.userList.length === 1) {
        	this.onEnd(this.userList[0].name);
        }
    }
    
    buildPlayerList () {
        let list = this.userList.map((f) => this.users[f].name).join(", ");
        return "Players (" + this.userList.length + "): " + list;
    }

}

class TypeBattleGamePlayer extends Rooms.botGamePlayer {
    constructor (user, game) {
        super (user);
        
        this.hand = [];
        this.picked = false;
        this.table = [];
        this.points = 0;
    }

    resetTable() {
    	this.table = [];
    }
    
    sendHand () {
        // build hand
        let hand = this.hand.sort().join(", ");
        this.user.sendTo("Your hand: " + hand + ".");
    }
    
    receiveCard (card) {
        this.hand.push(card);
    }

    attemptToPick(type) {
    	if (this.picked) {
    		this.user.sendTo("You have already picked");
    		return false;
    	}
    	let isValidType = false;
    	if (type === wild) {
    		this.user.sendTo("You cannot pick wild. Pick a type you do not have to use your wild card.");
    		return false;
    	}
    	// make sure type name is valid
    	typeNames.forEach((name) => {
    		if (name === type) {
    			isValidType = true;
    		}
    	});
    	if (!isValidType) {
    		this.user.sendTo("You must pick a valid type.");
    		return false;
    	}
    	// make sure you have that card
    	let hasWild = false;
    	let alreadyPicked = false;
    	this.hand.forEach((card) => {
    		if (card === type) {
    			this.hand.splice(this.hand.indexOf(card), 1);
    			this.table.push(card);
    			this.picked = true;
    			alreadyPicked = true;
    		} else if (card === wild) {
    			hasWild = true;
    		}
    	});
    	if (alreadyPicked) {
    		return true;
    	}
    	// if you have a wild and not the type, use up the wild card
    	if (hasWild) {
    		this.hand.splice(this.hand.indexOf(wild), 1);
    		this.table.push(type);
    		this.picked = true;
    		this.user.sendTo("You have used a WILD card.");
    		return true;
    	} else {
    		this.user.sendTo("You do not have that type.");
    		return false;
    	}
    }
}

exports.commands = {
    typebattle: function (target, room, user) {
        if (!room || !this.can("games")) return false;
        if(room.game) return this.send("There is already a game going on in this room! (" + room.game.gameName + ")");
        let args = target.split(',');
        let targetUser = args[0];
        if (targetUser === "") {
        	this.send("You must choose a player to challenge to a Type Battle!");
        	return;
        }
        challenger = user.name;
        challenged = targetUser;
        let cardNum = parseInt(args[1]);
        if (isNaN(cardNum) || cardNum <= 0 || cardNum > maxTypeCount) {
            cardNum = defaultTypeCount;
        }
        startingTypeCount = cardNum;
        room.game = new TypeBattleGame(room);
        room.game.onInit(user);
    },
    accept: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "typebattle") return false;
        room.game.onAccept(user);
    },
};

Events.on(["pm"], (id, room, msgType, msg) => {
	if (!room || !room.game || room.game.gameId !== "typebattle") return false;
	let parts = msg.split("|");
	if (parts.length < 3 || parts[0] === parts[1]) {
		return;
	}
    parts.splice(1, 1);
    let user = Users.get(parts[0]);
    let target = parts[1].split(" ");
    if (target[0] !== room.commandCharacter[0] + "pick") {
    	return;
    }
    let type = target[1];
    if (type === "" || type === undefined) {
        user.sendTo("You must choose a type.");
        return;
    }
    room.game.onPick(user, type);
});