const net = require('net');
const uuid = require('uuid');
const debug = require('debug')('server');

/**
 * @todo
 * - play multiple rounds ('Tough luck "kaboodles", but do you want to play again?')
 * - need to fix multiple rounds
 * - display results history
 * - add players to rounds, rather than to the actual game
 * - validate input
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
      };
    }
    if (guess1.value === 'rock' && guess2.value === 'scissors') {
      return {
        result: 'rock breaks scissors',
        winner: guess1.playreId
      };
    }
    if (guess1.value === 'paper' && guess2.value === 'rock') {
      return {
        result: 'paper covers rock',
        winner: guess1.playerId
      };
    }
    if (guess1.value === 'scissors' && guess2.value === 'paper') {
      return {
        result: 'scissors cuts paper',
        winner: guess1.playerId
      };
    }

    if (guess2.value === 'rock' && guess1.value === 'scissors') {
      return {
        result: 'rock breaks scissors',
        winner: guess2.playerId
      };
    }
    if (guess2.value === 'paper' && guess1.value === 'rock') {
      return {
        result: 'paper covers rock',
        winner: guess2.playerId
      };
    }
    if (guess2.value === 'scissors' && guess1.value === 'paper') {
      return {
        result: 'scissors cuts paper',
        winner: guess2.playerId
      };
    }
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
  let numberOfPlayers, anotherRound;

  switch(cmd) {
    case 'JOIN':
      player.name = pkt.msg;
      numberOfPlayers = game.addPlayer(player);

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

    case 'TRY_AGAIN':
      numberOfPlayers = game.players.length;
      anotherRound = String(pkt.msg).trim().toLowerCase().indexOf(0) !== 'n';
      if (!anotherRound) {
        numberOfPlayers = game.removePlayer(player.id);
      }

      return {
        action: 'another_round',
        value: anotherRound,
        numberOfPlayers
      };

    default:
      return {
        type: 'unknown'
      };
  }
};

const broadcast = (pkt) => {
  const players = game.players;

  debug('broadcast', pkt);

  players.forEach((player) => {
    const conn = player.conn;
    if (conn) {
      conn.write(JSON.stringify(pkt));
    }
  });
};

const buildRoundResultMessage = (result) => {
  let msg;

  debug('buildRoundResultMessage', result);

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
  const player = {
    id: uuid(),
    conn
  };

  conn.write(JSON.stringify({
    cmd: 'IDENT'
  }));

  conn.on('data', (data) => {
    const pkt = JSON.parse(data.toString());
    const resp = processCommand(pkt, player);

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
        const resultMsg = buildRoundResultMessage(result);
        game.addToHistory();

        console.log(resultMsg);  // eslint-disable-line no-console

        broadcast({
          cmd: 'TRY_AGAIN'
        });
      }
    }

    /**
     * Really we should add the player to the new round.  And when we have
     * two player, then initiate "SHOOT".
     */
    if (resp.action === 'another_round') {
      if (resp.value && resp.numberOfPlayers === 2) {
        game.makeRound();

        broadcast({
          cmd: 'SHOOT'
        });
      }
    }
  });

  conn.on('close', () => {
    const msg = `player "${player.name}" left.`;
    game.removePlayer(player.id);
    console.log(msg);  // eslint-disable-line no-console
  });
});

server.listen(5432, () => {
  console.log('listening for players');  // eslint-disable-line no-console
});
