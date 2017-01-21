const fs = require('fs');
const net = require('net');
const uuid = require('uuid');
const debug = require('debug')('rps-server');

/**
 * @todo
 * - take input from console
 * - play multiple rounds ('Tough luck "kaboodles", but do you want to play again?')
 * - display results history
 */

class Round {
  constructor() {
    this.guesses = [];
    this.winner = null;
  }

  addGuess(guess) {
    this.guesses.push(guess);
    return this.guesses.length;
  }

  arePlayersDone() {
    return this.guesses.length === 2;
  }

  compare() {
    if (!this.arePlayersDone()) {
      return {
        result: null,
        winner: null
      };
    }

    const guess1 = this.guesses[0];
    const guess2 = this.guesses[1];

    if (guess1.value === guess2.value) {
      return {
        result: 'tie',
        winner: null
      }
    }
    if (guess1.value === 'rock' && guess2.value === 'scissors') {
      return {
        result: 'rock breaks scissors',
        winner: guess1.playreId
      }
    }
    if (guess1.value === 'paper' && guess2.value === 'rock') {
      return {
        result: 'paper covers rock',
        winner: guess1.playerId
      }
    }
    if (guess1.value === 'scissors' && guess2.value === 'covers') {
      return {
        result: 'scissors cuts paper',
        winner: guess1.playerId
      }
    }

    if (guess2.value === 'rock' && guess1.value === 'scissors') {
      return {
        result: 'rock breaks scissors',
        winner: guess2.playerId
      }
    }
    if (guess2.value === 'paper' && guess1.value === 'rock') {
      return {
        result: 'paper covers rock',
        winner: guess2.playerId
      }
    }
    if (guess2.value === 'scissors' && guess1.value === 'covers') {
      return {
        result: 'scissors cuts paper',
        winner: guess2.playerId
      }
    }

    this.guesses.forEach((guess) => {
      console.log(guess);
    });
  }
}

class Game{
  constructor() {
    this._players = [];
    this._currentRound = null;
    this._history = [];
  }

  addPlayer(player) {
    this._players.push(player);
    return this._players.length;
  }

  removePlayer(id) {
    this._players = this._players.filter((player) => {
      return player.id !== id;
    });
    return this._players.length;
  }

  get players() {
    return this._players;
  }

  getPlayerById(id) {
    return this._players.filter(player => player.id === id)[0];
  }

  makeRound() {
    this._currentRound = new Round();
    return this.currentRound;
  }

  get currentRound() {
    return this._currentRound;
  }

  addToHistory() {
    this._history.push(this._currentRound);
    this._currentRound = null;
  }
}

let game = new Game();

const processCommand = (pkt, player) => {
  const {cmd} = pkt;
  switch(cmd) {
    case 'JOIN':
      player.name = pkt.msg;
      const numberOfPlayers = game.addPlayer(player);

      return {
        action: 'player_added',
        player,
        numberOfPlayers
      };

    case 'GUESS':
      return {
        action: 'player_guessed',
        value: pkt.msg
      };
    default:
      return {
        type: 'unknown'
      }
  }
}

const broadcast = (pkt) => {
  const players = game.players;

  players.forEach((player) => {
    const conn = player.conn;
    if (conn) {
      conn.write(JSON.stringify(pkt));
    }
  });
};

const buildRoundResultMessage = (result) => {
  let msg;

  if (result.result === 'tie') {
    const players = game.players;
    const playersNames = players.map(player => player.name);
    msg = `That round ended in a tie.  "${playersNames[0]}" and "${playersNames[1]}", you'll have to try harder.`;
  } else {
    const name = game.getPlayerById(result.winner).name;
    msg = `"${name}" won (${result.result})!`;
  }

  return msg;
};

const server = net.createServer((conn) => {
  console.log('player connected');

  const player = {
    id: uuid(),
    conn
  };

  conn.write(JSON.stringify({
      "cmd": "IDENT"
  }));

  conn.on('data', (data) => {
    console.log('from client' + data + '\n');

    const pkt = JSON.parse(data.toString());
    const resp = processCommand(pkt, player);

    console.log(resp.action);

    if (resp.action === 'player_added' && resp.numberOfPlayers === 2) {
      game.makeRound();

      broadcast({
        cmd: 'SHOOT'
      });
    }

    if (resp.action === 'player_guessed') {
      game.currentRound.addGuess({
        playerId: player.id,
        value: resp.value
      });

      if (game.currentRound.arePlayersDone()) {
        const result = game.currentRound.compare();

        console.log('result', result);

        const resultMsg = buildRoundResultMessage(result);
        console.log(resultMsg);
        game.addToHistory();
      }
    }
  });

  conn.on('close', () => {
    const msg = `player "${player.name}" left.`
    console.log(msg);
  });
});

server.listen(5432, () => {
  console.log('listening for players');
});
