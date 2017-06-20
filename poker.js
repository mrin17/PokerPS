/**
 * Poker Game for Pokemon Showdown
 * Originally intended for use with Sparkychild's Bot
 * Code by Kant Ketchum
 *
 * TODOS
 * 1) big/little blinds and rotating people who start
 * 3) account for max chips a player can win if they all in
 * 4) arguments for big/small blind (add a maximum!)
 * 5) enforce max players of 8 or 10
 * 6) leaderboards!
 * 7) .leave option
 */

'use strict';

exports.game = "poker";
exports.aliases = ["pkr"];

const values = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const faces = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const cardTypes = [0, 1, 2, 3];
const cardBitTypes = [1, 2, 4, 8];
const symbols = {
    0: "♦",
    2: "♥",
    3: "♠",
    1: "♣",
};
const hands=["High Card", "1 Pair", "2 Pair", "3 of a Kind", "Straight", 
             "Flush", "Full House", "4 of a Kind", "Straight Flush", "Royal Flush"];
const handRankings=[7, 8, 4, 5, 0, 1, 2, 9, 3, 6];
const defaultStartingChipCount = 50;
const startingBuyIn = 2;
const houseRakePerPlayerPerRound = 1;
let startingChipCount = defaultStartingChipCount;

class PokerGame extends Rooms.botGame {
    constructor(room, amount) {
        super(room);
        
        this.currentPlayer = null;
        this.allowJoins = true;
        this.state = "signups";
        this.gameId = "poker";
        this.gameName = "Poker";
        this.answerCommand = "special";
        this.dealer = new PokerGamePlayer({name: "Poker"});
        this.pot = 0;
        this.bet = 0;
        this.userIDWhoLastBet = 0;
        this.cards = [];
        this.playersRemaining = 0;
        this.numPlayersAllIn = 0;
        
        this.playerObject = PokerGamePlayer;
        this.sendRoom("A new game of Poker is starting. " + this.command("join") + " to join the game.");
        this.sendRoom("Some important things I didn't add yet to this version of Poker: (1) No rotating blinds, everyone buys in. (2) Everyone who wins a pot splits it evenly.");
    }

    command(cmd) {
        return "``" + this.room.commandCharacter[0] + cmd + "``";
    }
    
    shuffleDeck () {
        let deck = [];
        values.forEach((v) =>{
            cardTypes.forEach((t) => {
                deck.push({"value": v, "type": t});
            });
        });
        return this.deck = Tools.shuffle(deck);
    }
    
    onStart () {
        if(this.userList.length < 2 || this.state === "started") return false;
        this.state = "started";
        this.newHand();
    }

    newHand() {
        if (this.state !== "started") return false;
        
        this.shuffleDeck();
        this.pot = 0;
        this.bet = 0;
        this.userIDWhoLastBet = 0;
        this.cards = [];
        this.playersRemaining = this.userList.length;
        this.numPlayersAllIn = 0;

        //everyone rejoins hand
        this.userList.forEach((u) => {
        	let player = this.users[toId(u)];
        	player.newHand();
        });

        let cardQueue = this.userList.concat(this.userList);

        // deal 2 cards for each player;
        cardQueue.forEach((u, index) => {
            this.giveCard(toId(u));
        });
        // everyone gets to see their hand;
        this.userList.forEach((u) => { 
        	let player = this.users[toId(u)];
        	player.sendHand();
            //everyone buys in for now
            this.onBuyIn(player, toId(u));
        });
        // if everyone isn't buying in, dont do this
        this.bet = 0;
        this.houseRake();
        this.setNextPlayer();
        this.initTurn();
    }
    
    initTurn () {
        let player = this.users[this.currentPlayer];
        let chips = player.chips;
        if (chips === 0) {
            this.onTurnEnd(player);
        } else {
            this.sendRoom(player.name + "'s turn. " + this.pot + " in pot, " + this.bet + " to call. You have " + chips + " chips. (" + this.command("fold") + ", " + this.command("call") + ", " + this.command("raise X") + ")");
            this.timer = setTimeout(() => {
                this.users[this.currentPlayer].folded = true;
                this.playersRemaining = this.playersRemaining - 1;
                if (this.eliminate()) {
                    this.initTurn();
                }
            }, 90000);
        }
        
    }
    
    giveCard (userid) {
        let card = this.deck.shift();
        if (!this.deck.length) this.shuffleDeck();
        let player = this.users[userid];
        player.receiveCard(card);
    }

    houseRake() {
        let totalRake = houseRakePerPlayerPerRound * this.userList.length;
        this.pot = this.pot - totalRake;
        this.sendRoom("House rakes in " + totalRake + ". Pot is " + this.pot + ".");
    }
    
    onFold (user) {
        if (this.state !== "started" || user.userid !== this.currentPlayer) return false;
        let player = this.users[user.userid];
        this.sendRoom(player.name + " has folded.");
        this.playersRemaining = this.playersRemaining - 1;
        this.onTurnEnd(user);
    }

    onBuyIn(player, userid) {
        this.addChipsToPot(player, userid, startingBuyIn, "bought in");
    }

    onCall (user) {
        this.putChipsInPot(user, this.bet, "called");
    }

    onBet (user, amount) {
    	let player = this.users[user.userid];
    	if (amount <= this.bet) {
    		this.sendRoom("To raise, you must put in more than " + this.bet + " chips.");
    	} else if (amount > player.chips) {
    		this.sendRoom("You cannot bet more than what you have, which is " + player.chips + " chips.");
    	} else if (amount == player.chips) {
			this.putChipsInPot(user, amount, "went all in");
    	} else {
    		this.putChipsInPot(user, amount, "raised");
    	}
    }

    putChipsInPot(user, chips, action) {
        if (this.state !== "started" || user.userid !== this.currentPlayer) return false;
        let player = this.users[user.userid];
        this.addChipsToPot(player, user.userid, chips, action);
        this.onTurnEnd(user);
    }

    addChipsToPot(player, userid, chips, action) {
        let betChips = player.bet(chips);
        if (chips > this.bet) {
            this.bet = chips;
            this.userIDWhoLastBet = userid;
        }
        this.pot = this.pot + betChips;
        if (player.chips == 0) {
        	this.numPlayersAllIn++;
        }
        this.sendRoom(player.name + " has " + action + " with " + betChips + ". They have " + player.chips + " chips remaining. Pot is " + this.pot + ".");
    }
    
    onTurnEnd (user) {
        if (this.state !== "started" || (user && user.userid !== this.currentPlayer)) return false;
        clearTimeout(this.timer);
        let foundPlayer = this.searchForAndSetNextPlayer(user);
        if (!foundPlayer) {
            this.newHand();
        } else {
            // if there's one left, end round. If we are all square, flop, otherwise keep going
            if (this.playersRemaining == 1) {
                this.playersWin([this.users[this.currentPlayer]]);   
            } else if (this.currentPlayer === this.userIDWhoLastBet) {
                this.flop();
            } else {
                this.initTurn();
            }
        }
    }

    searchForAndSetNextPlayer(user) {
        let count = this.userList.length;
        // find next player who hasn't folded
        while (!this.setNextPlayer()) {
            count = count - 1;
            if (count <= 0) {
                // something fishy happened, everyone is folded
                // nuke the pot and restart
                this.sendRoom("Everyone folded. Pot goes to the house.");
                return false;
            }
        }
        return true;
    }
    
    setNextPlayer () {
        if(this.userList.length === 0) return false;
        // get first player in the list
        this.currentPlayer = this.userList.shift();
        // put current player at the end of the list
        this.userList.push(this.currentPlayer);

        // check if all players have moved
        if (this.users[this.currentPlayer].folded) return false;
        return true;
    }

    flop() {
        if (this.cards.length === 0) {
            this.cards.push(this.deck.shift());
            this.cards.push(this.deck.shift());
            this.cards.push(this.deck.shift());
            this.displayFloppedCards();
        } else if (this.cards.length === 3) {
            this.cards.push(this.deck.shift());
            this.displayFloppedCards();
        } else if (this.cards.length === 4) {
            this.cards.push(this.deck.shift());
            this.displayFloppedCards();
        } else {
            this.onRoundEnd();
        }
    }

    displayFloppedCards() {
        let table = this.cards.map((c) => "[" + symbols[c.type] + faces[c.value] + "]").join(", ");
        this.sendRoom("The table: " + table + ".");
        this.bet = 0;
        if (this.playersRemaining - this.numPlayersAllIn == 1) {
        	this.flop();
        } else {
        	this.initTurn();
        }
    }

    onRoundEnd() {
        // sum up players
        let winningPlayers = [];
        let currentBestRankThenKickers = [-1, [-1]];
        for(var p in this.users) {
            if(!this.users[p].folded) {
                let rankThenKickers = this.users[p].getHandValue(this.cards);
                let cardText = this.users[p].hand.map((c) => "[" + symbols[c.type] + faces[c.value] + "]").join(" ");
                let kickerText = rankThenKickers[1].map((rank) => faces[rank]).join(" ");
                this.sendRoom(this.users[p].name + " has " + cardText + ": " + hands[rankThenKickers[0]] + ", " + kickerText + ".");
                if (rankThenKickers[0] > currentBestRankThenKickers[0]) {
                    winningPlayers = [];
                    winningPlayers.push(this.users[p]);
                    currentBestRankThenKickers = rankThenKickers;
                } else if (rankThenKickers[0] == currentBestRankThenKickers[0]) {
                    // push them beforehand because why not, it'll get overwritten if they lose
                    winningPlayers.push(this.users[p]);
                    for (var i = 0; i < rankThenKickers[1].length; i++) {
                        if (currentBestRankThenKickers[1][i] < rankThenKickers[1][i]) {
                            winningPlayers = [];
                            winningPlayers.push(this.users[p]);
                            currentBestRankThenKickers = rankThenKickers;
                            break;
                        }
                    }
                }
            }
        }
        this.playersWin(winningPlayers);
    }

    playersWin(winningPlayers) {
    	let list = winningPlayers.map((f) => f.name).sort().join(", ");
        let chipVal = this.pot / winningPlayers.length;
        this.sendRoom("Hand over. Winners: " + list  + ". They each win " + chipVal + " chips.");
        winningPlayers.map((f) => { f.chips = f.chips + chipVal});
        // check if anyone has 0 chips
        this.checkForLosers();
        if (this.userList.length == 1) {
            this.onEnd(list);
        } else {
        	this.newHand();
        }
    }

    checkForLosers() {
        let losingPlayers = [];
        for(var p in this.users) {
            if(this.users[p].chips == 0) {
                losingPlayers.push(this.users[p]);
            }
        }
        losingPlayers.map((f) => {
            this.sendRoom(f.name + " has busted!");
            this.eliminate(f.userid);
        });
    }
    
    onEnd (winnerName) {
        this.sendRoom("Game is over! " + winnerName + " wins!");
        this.destroy();
    }

    eliminate (userid) {
        userid = userid || this.currentPlayer;
        //remove players
        delete this.users[userid];
        this.userList.splice(this.userList.indexOf(userid), 1);
        
        if (!this.searchForAndSetNextPlayer()) {
            this.onEnd();
            return false;
        }
        return true;
    }
    
    buildPlayerList () {
        let list = this.userList.map((f) => this.users[f].name).sort().join(", ");
        return "Players (" + this.userList.length + "): " + list;
    }
}

class PokerGamePlayer extends Rooms.botGamePlayer {
    constructor (user, game) {
        super (user);
        
        this.hand = [];
        this.folded = false;
        this.chips = startingChipCount;
        this.value = 0;
    }
    
    sendHand () {
        // build hand
        let hand = this.hand.sort((a, b) => {
            // sort by value first
            if(a.value > b.value) return -1;
            if(a.value < b.value) return 1;
            // if values are the same, sort by suit
            if(cardTypes.indexOf(a.type) > cardTypes.indexOf(b.type)) return 1;
            return -1;
        }).map((c) => "[" + symbols[c.type] + faces[c.value] + "]").join(", ");
        this.user.sendTo("Your hand: " + hand + ".");
    }

    bet(numChips) {
        let bet = numChips;
        if (this.chips < bet) {
            bet = this.chips;
            // ALL IN TRIGGER - idk what to do here
        }
        this.chips = this.chips - bet;
        return bet;
    }

    newHand() {
        this.folded = false;
        this.hand = [];
        this.value = 0;
    }
    
    receiveCard (card) {
        this.hand.push(card);
    }

    // NOT MY CODE - from here: 
    // https://www.codeproject.com/Articles/569271/A-Poker-hand-analyzer-in-JavaScript-using-bit-math
    // Calculates the Rank of a 5 card Poker hand using bit manipulations.
    
    rankPokerHand(cards) {
      var v, i, o, s = 1<<cards[0].value|1<<cards[1].value|1<<cards[2].value|1<<cards[3].value|1<<cards[4].value;
      for (i=-1, v=o=0; i<5; i++) {
      	v += o*((v/o&15)+1);
      	if (i < 4) {
      		o=Math.pow(2,cards[i+1].value*4);
      	}
      }  
      v = v % 15 - ((s/(s&-s) == 31) || (s == 0x403c) ? 3 : 1);
      v -= (cardBitTypes[cards[0].type] == (cardBitTypes[cards[1].type]|cardBitTypes[cards[2].type]|cardBitTypes[cards[3].type]|cardBitTypes[cards[4].type])) * ((s == 0x7c00) ? -5 : 1);
      //console.log("Hand: " + this.cardString(cards) + ": " + handRankings[v]);
      return v;
    }
    
    /*
    rankPokerHand(cards) {
      var v, i, o, s = 1<<cards[0].value|1<<cards[1].value|1<<cards[2].value|1<<cards[3].value|1<<cards[4].value|1<<cards[5].value|1<<cards[6].value;
      for (i=0, v=o=0; i<cards.length; i++) {
      	v += o*((v/o&15)+1);
      	o=Math.pow(2,cards[i].value*4);
      }
      v = v % 15 - ((s/(s&-s) == 31) || (s == 0x403c) ? 3 : 1);
      var suits = [0, 0, 0, 0];
      for (var card in cards) {
        suits[card.type]++;
      }
      v -= (suits[0] >= 5 || suits[1] >= 5 || suits[2] >= 5 || suits[3] >= 5) * ((s == 0x7c00) ? -5 : 1);
      return v;
    }
    */
    /*
    getHandValue (cards) {
        let realHand = this.hand.concat(cards);
        return handRankings[this.rankPokerHand(realHand)];
    }
	*/
    getHandValue (cards) {
    	//deck.push();
        // manually go through all 21 possibilities
        // currently no differentiation between the values of the cards
        let KICKER_SEARCH = true;
        let realHand = this.hand.concat(cards);
        let cardIndices = [4, 3, 2, 1, 0];
        let indexToIncrement = 0;
        let bestHand = [];
        let bestRank = -1;
        let done = false;
        while (!done) {
        	let hand = [realHand[cardIndices[0]], 
        	            realHand[cardIndices[1]], 
        	            realHand[cardIndices[2]], 
        	            realHand[cardIndices[3]], 
        	            realHand[cardIndices[4]]];
        	let value = handRankings[this.rankPokerHand(hand)]; 
            // TODO - account for kickers!!!!!!!!
        	if (value > bestRank) {
        		bestHand = hand;
        		bestRank = value;
        	} else if (value == bestRank && KICKER_SEARCH) {
                let kickers1 = this.getKickers(bestHand, value);
                let kickers2 = this.getKickers(hand, value);
                for (var i = 0; i < kickers1.length; i++) {
                    if (kickers1[i] < kickers2[i]) {
                        bestHand = hand;
                        break;
                    }
                }
            }
        	cardIndices[indexToIncrement] = cardIndices[indexToIncrement] + 1;
        	while (cardIndices[indexToIncrement] > realHand.length - indexToIncrement - 1) {
        		indexToIncrement++;
        		if (indexToIncrement > cardIndices.length - 1) {
        			done = true;
        			break;
        		}
        		cardIndices[indexToIncrement] = cardIndices[indexToIncrement] + 1;
        	}
        	while (indexToIncrement > 0) {
        		cardIndices[indexToIncrement - 1] = cardIndices[indexToIncrement] + 1;
        		indexToIncrement--;
        	}
        }
        let kickers = this.getKickers(bestHand, bestRank);
        //console.log("Best Hand: " + bestHand[0].value + ", " + bestHand[1].value + ", " + bestHand[2].value + ", " + bestHand[3].value + ", " + bestHand[4].value);
        return [bestRank, kickers];
    }

    getKickers(winningHand, rank) {
        let sortedHand = winningHand.sort((a, b) => {
            // sort by value first
            if(a.value > b.value) return -1;
            if(a.value < b.value) return 1;
            return -1;
        });
        // High Card, Flush, Royal Flush - take highest card
        // 1 Pair, 3 of a kind, 4 of a kind - take highest duplicated card
        // 2 Pair - take two highest duplicated cards
        // Straight, Straight Flush - take highest card unless its a low ace
        // Full House - push the 3 of a kind first, then the two of a kind
        if (rank == 0 || rank == 5 || rank == 9) {
            return [sortedHand[0].value, sortedHand[1].value, sortedHand[2].value, sortedHand[3].value, sortedHand[4].value];
        } else if (rank == 1 || rank == 3 || rank == 7) {
            let winners = [];
            let rest = [];
            for (var i = 0; i < sortedHand.length; i++) {
                if (winners.length > 0) {
                    if (sortedHand[i].value == winners[0]) {
                        winners.push(sortedHand[i].value);
                    } else {
                        rest.push(sortedHand[i].value);
                    }
                } else {
                    if (sortedHand[i].value == sortedHand[i+1].value) {
                        winners.push(sortedHand[i].value);
                    } else {
                        rest.push(sortedHand[i].value);
                    }
                }
                
            }
            return winners.concat(rest);
        } else if (rank == 2) {
            let winners = [];
            let rest = [];
            for (var i = 0; i < sortedHand.length; i++) {
                if (i < sortedHand.length - 1 && sortedHand[i].value == sortedHand[i+1].value) {
                    winners.push(sortedHand[i].value);
                    winners.push(sortedHand[i+1].value);
                    i++;
                } else {
                    rest.push(sortedHand[i].value);
                }
            }
            return winners.concat(rest);
        } else if (rank == 4 || rank == 8) {
            if (sortedHand[0].value == 14 && sortedHand[1].value == 5) {
                return [sortedHand[1].value, sortedHand[2].value, sortedHand[3].value, sortedHand[4].value, sortedHand[0].value];
            } else {
                return [sortedHand[0].value, sortedHand[1].value, sortedHand[2].value, sortedHand[3].value, sortedHand[4].value];
            }
        } else if (rank == 6) {
            if (sortedHand[0].value == sortedHand[2].value) {
                return [sortedHand[0].value, sortedHand[1].value, sortedHand[2].value, sortedHand[3].value, sortedHand[4].value];
            } else {
                return [sortedHand[4].value, sortedHand[3].value, sortedHand[2].value, sortedHand[1].value, sortedHand[0].value];
            }
        }
        return [0, 0, 0, 0, 0];
    }

    cardString(cards) {
    	return cards.map((c) => "[" + symbols[c.type] + faces[c.value] + "]").join(" ");
    }
}

exports.commands = {
    poker: function (target, room, user) {
        if (!room || !this.can("games")) return false;
        if(room.game) return this.send("There is already a game going on in this room! (" + room.game.gameName + ")");
        let amount = parseInt(target);
        if (isNaN(amount) || amount <= 0 || amount > 400) {
            amount = defaultStartingChipCount;
        }
        startingChipCount = amount;
        room.game = new PokerGame(room);
    },
    fold: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        room.game.onFold(user);
    },
    call: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        room.game.onCall(user);        
    },
    raise: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        let amount = parseInt(target);
        if (isNaN(amount) || amount <= 0) {
        	return this.send("Invalid amount to raise");
        }
        room.game.onBet(user, amount);
    }
};
