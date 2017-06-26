/**
 * Poker Game for Pokemon Showdown
 * Originally intended for use with Sparkychild's Bot
 * Code by Kant Ketchum
 *
 * TODOS
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
const startingBuyIn = 1;
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
        this.userIDWhoLastBet = 0;
        this.nextSmallBlindPlayer = "";
        this.currentSmallBlindPlayer = "";
        this.cards = [];
        this.playersRemaining = 0;
        this.numPlayersAllIn = 0;
        this.amountsPlayersBet = [];
        this.highestBet = 0;
        this.firstSetup = true;
        
        this.playerObject = PokerGamePlayer;
        this.sendRoom("A new game of Poker is starting. " + this.command("join") + " to join the game.");
        this.sendRoom("Commmands: (" + this.command("fold") + ", " + this.command("check") + ", " + this.command("call") + ", " + this.command("raise X") + ")");
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
        this.userIDWhoLastBet = '';
        this.highestBet = 0;
        this.cards = [];
        this.amountsPlayersBet = [];
        this.playersRemaining = this.userList.length;
        this.numPlayersAllIn = 0;

        //everyone rejoins hand
        this.userList.forEach((u) => {
            if (this.firstSetup) {
                this.userIDWhoLastBet = toId(u);
                this.nextSmallBlindPlayer = toId(u);
                this.currentSmallBlindPlayer = toId(u);
                this.firstSetup = false;
            }
            this.currentPlayer = toId(u);
        	let player = this.users[toId(u)];
            this.amountsPlayersBet[toId(u)] = 0;
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
        });
        this.triggerBuyIn();
        // if everyone isn't buying in, dont do this
        //let totalRake = houseRakePerPlayerPerRound * this.userList.length;
        //this.pot = this.pot - totalRake;
        this.initTurn();
    }

    triggerBuyIn() {
        this.seekForPlayer(this.nextSmallBlindPlayer);
        var p1 = this.currentPlayer;
        this.currentSmallBlindPlayer = p1;
        this.setNextPlayer();
        var p2 = this.currentPlayer;
        this.nextSmallBlindPlayer = p2;
        this.onBuyIn(this.users[p1], startingBuyIn, p1);
        this.onBuyIn(this.users[p2], startingBuyIn * 2, p2);
        this.sendRoom("BLINDS: " + this.users[p1].name + " (" + startingBuyIn + "), " + this.users[p2].name + " (" + startingBuyIn * 2 + ")");
        this.setNextPlayer();
        this.userIDWhoLastBet = this.currentPlayer; // so the big blind can choose to call or not
        this.sendRoom("POT: " + this.pot);
    }

    seekForPlayer(user) {
        // SEARCH FOR USER IN LIST
        var len = this.userList.length;
        while (len > 0 && this.currentPlayer != user) {
            this.setNextPlayer();
            len--;
        }

        if (this.users[this.currentPlayer].folded) {
        	len = this.userList.length;
        	while (!this.setNextPlayer()) {
				len--;
        	}
        }

    }
    
    initTurn () {
        let player = this.users[this.currentPlayer];
        let chips = player.chips;
        let numToCall = this.getNumToCall(this.currentPlayer);
        if (chips === 0) {
            this.onTurnEnd(player);
        } else {
            this.sendRoom(player.name + "'s turn (((" + chips + " chips)))  " + numToCall + " to call.");
            this.timer = setTimeout(() => {
                this.users[this.currentPlayer].folded = true;
                this.playersRemaining = this.playersRemaining - 1;
                if (this.eliminate()) {
                    this.initTurn();
                }
            }, 90000);
        }
        
    }

    getNumToCall(userid) {
        return this.highestBet - this.amountsPlayersBet[userid];
    }
    
    giveCard (userid) {
        let card = this.deck.shift();
        if (!this.deck.length) this.shuffleDeck();
        let player = this.users[userid];
        player.receiveCard(card);
    }
    
    onFold (user) {
        if (this.state !== "started" || user.userid !== this.currentPlayer) return false;
        let player = this.users[user.userid];
        player.folded = true;
        this.sendRoom(player.name + " has folded.");
        this.playersRemaining = this.playersRemaining - 1;
        this.onTurnEnd(user);
    }

    onBuyIn(player, amount, userid) {
        this.addChipsToPot(player, userid, amount, "");
    }

    onCall (user) {
        if (this.state !== "started" || user.userid !== this.currentPlayer) return false;
        this.putChipsInPot(user, this.getNumToCall(this.currentPlayer), "called");
    }

    onCheck (user) {
        if (this.state !== "started" || user.userid !== this.currentPlayer) return false;
        if (this.getNumToCall(this.currentPlayer) !== 0) {
            this.sendRoom("You cannot check because someone raised, you must either call or raise.");
        } else {
           this.putChipsInPot(user, 0, "called"); 
        }
    }

    onBet (user, amount) {
    	let player = this.users[user.userid];
        let numToCall = this.getNumToCall(user.userid);
    	if (amount <= numToCall) {
    		this.sendRoom("To raise, you must put in more than " + numToCall + " chips.");
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
        let numToCall = this.getNumToCall(userid);
        this.amountsPlayersBet[userid] += betChips;
        if (betChips > numToCall) {
            this.userIDWhoLastBet = userid;
            this.highestBet = this.amountsPlayersBet[userid];
        }
        this.pot = this.pot + betChips;
        if (player.chips == 0) {
        	this.numPlayersAllIn++;
        }
        if (action !== "") {
            if (player.chips == 0) {
                this.sendRoom(player.name + " is ALL IN!");
            } else {
                this.sendRoom(player.name + " has " + player.chips + " chips remaining.");
            }
            this.sendRoom("POT: " + this.pot + " chips");
        }
    }
    
    onTurnEnd (user) {
        if (this.state !== "started" || (user && user.userid !== this.currentPlayer)) return false;
        clearTimeout(this.timer);
        let foundPlayer = this.searchForAndSetNextPlayer();
        if (!foundPlayer) {
            this.newHand();
        } else {
            // if there's one left, end round. If we are all square, flop, otherwise keep going
            if (this.playersRemaining == 1) {
                this.playersWin([[this.users[this.currentPlayer]]]);   
            } else if (this.currentPlayer === this.userIDWhoLastBet) {
                this.flop();
            } else {
                this.initTurn();
            }
        }
    }

    searchForAndSetNextPlayer() {
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
        if (this.playersRemaining - this.numPlayersAllIn == 1) {
        	this.flop();
        } else {
            // weird rule where if there are 2 players left, big blind player starts bets after flops
            // otherwise, it's the small blind player
            if (this.userList.length === 2) {
                this.seekForPlayer(this.nextSmallBlindPlayer);
            } else {
                this.seekForPlayer(this.currentSmallBlindPlayer);
            }
            this.userIDWhoLastBet = this.currentPlayer;
        	this.initTurn();
        }
    }

    onRoundEnd() {
        // sum up players
        // An array of arrays of users
        // [[Player:kantketchum, Player:fearthelee], [Player:seoking]] means kant and lee tied the hand and seo was in 2nd
        let winningPlayers = [];
        for(var p in this.users) {
            if(!this.users[p].folded) {
                this.users[p].setHandValue(this.cards);
                let rankThenKickers = this.users[p].handValue;
                let cardText = this.users[p].hand.map((c) => "[" + symbols[c.type] + faces[c.value] + "]").join(" ");
                let kickerText = rankThenKickers[1].map((rank) => faces[rank]).join(" ");
                this.sendRoom(this.users[p].name + " has " + cardText + ": " + hands[rankThenKickers[0]] + ", " + kickerText + ".");
                // go through all indices of winningPlayers, compare to winningPlayers[i][0].handValue
                // if tied, add to winningPlayers[i]. If better, insert before winningPlayers[i] as new array
                // if lose, continue
                // lastly push to the end as new array
                let added = false;
                for (var e = 0; e < winningPlayers.length; e++) {
                    let currentBestRankThenKickers = winningPlayers[e][0].handValue;
                    if (rankThenKickers[0] > currentBestRankThenKickers[0]) {
                        winningPlayers.splice(e, 0, [this.users[p]]);
                        added = true;
                        e++;
                        break;
                    } else if (rankThenKickers[0] == currentBestRankThenKickers[0]) {
                        let tied = true;
                        for (var i = 0; i < currentBestRankThenKickers[1].length; i++) {
                            if (currentBestRankThenKickers[1][i] < rankThenKickers[1][i]) {
                                winningPlayers.splice(e, 0, [this.users[p]]);
                                tied = false;
                                added = true;
                                e++;
                                break;
                                break;
                            } else if (currentBestRankThenKickers[1][i] > rankThenKickers[1][i]) {
                                tied = false;
                                break;
                            }
                        }
                        if (tied) {
                            winningPlayers[e].push(this.users[p]);
                        }
                    }
                }
                if (!added) {
                    // stupid arrays dont work they just append >.<
                    winningPlayers.push([this.users[p]]);
                }
            }
        }
        this.playersWin(winningPlayers);
    }

    playersWin(winningPlayers) {
    	let firstMessage = true;
        let playerIndex = 0;
        let totalChipsClaimed = 0;
        let list = "";
        //LOOP OVER WINNINGPLAYERS WHILE chipsRemaining > 0
        while (this.pot > 0 && playerIndex < winningPlayers.length) {
            let chipsTheyCanWin = winningPlayers[playerIndex].map((f) => this.getMostChipsPlayerCanWin(f.user.userid) - totalChipsClaimed);
            let minValue = chipsTheyCanWin.sort((a, b) => {return a < b;})[0];
            while (minValue > 0) {
                this.pot -= minValue;
                totalChipsClaimed += minValue;
                let winnings = minValue / winningPlayers[playerIndex].length;
                list = winningPlayers[playerIndex].map((f) => f.name).sort().join(", ");
                let potText = firstMessage ? "Hand over. WINNERS: " : "Side Pot: ";
                firstMessage = false;
                this.sendRoom(potText + list  + ".   + " + winnings + " chips each.");
                winningPlayers[playerIndex].map((f) => { f.chips = f.chips + winnings});
                // REMOVE PLAYERS WHO HAVE 0 TO WIN
                for (var i = 0; i < chipsTheyCanWin.length; i++) {
                    chipsTheyCanWin[i] -= minValue;
                    if (chipsTheyCanWin[i] <= 0) {
                        chipsTheyCanWin.splice(i, 1);
                        winningPlayers[playerIndex].splice(i, 1);
                        i--;
                    }
                }
                // reset minValue
                if (chipsTheyCanWin.length == 0) {
                    minValue = 0;
                } else {
                    minValue = chipsTheyCanWin.sort((a, b) => {return a < b;})[0];
                }
            }
            playerIndex++;
        }
        // check if anyone has 0 chips
        this.checkForLosers();
        if (this.userList.length == 1) {
            this.onEnd(list);
        } else {
        	this.newHand();
        }
    }

    getMostChipsPlayerCanWin(userid) {
        let totalChips = 0;
        for (var p in this.users) {
            if (this.amountsPlayersBet[p] <= this.amountsPlayersBet[userid]) {
                totalChips += this.amountsPlayersBet[p];
            } else {
                totalChips += this.amountsPlayersBet[userid];
            }
        }
        return totalChips;
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
        this.handValue = [];
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
            // ALL IN TRIGGER
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
      return v;
    }
    
    setHandValue (cards) {
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
                    } else if (kickers1[i] > kickers2[i]) {
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
        this.handValue = [bestRank, kickers];
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
    f: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        room.game.onFold(user);
    },
    call: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        room.game.onCall(user);        
    },
    c: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        room.game.onCall(user);        
    },
    check: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        room.game.onCheck(user);        
    },
    x: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        room.game.onCheck(user);        
    },
    raise: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        let amount = parseInt(target);
        if (isNaN(amount) || amount <= 0) {
        	return this.send("Invalid amount to raise");
        }
        room.game.onBet(user, amount);
    },
    r: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "poker") return false;
        let amount = parseInt(target);
        if (isNaN(amount) || amount <= 0) {
            return this.send("Invalid amount to raise");
        }
        room.game.onBet(user, amount);
    },
};
