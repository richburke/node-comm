const fs = require('fs');
const net = require('net');
const readline = require('readline');
const debug = require('debug')('rps-client');
const debugv = require('debug')('rps-client:verbose');

const PLAYS = ['rock', 'paper', 'scissors'];

// const name = process.argv[2];

const rdln = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'name> '
});

debug('created readline');
debugv('rl is', rdln);

rdln.question('What\'s your name? '), (resp) => {
  debug('question response: ', resp);

  runClient(resp.trim());
  rdln.close();
}
rdln.on('line', (resp) => {
  debug('line response: ', resp);

  runClient(resp.trim());
  rdln.close();
});
rdln.prompt();

const runClient = (name) => {
  const client = net.connect({port: 5432});

  const processCommand = (pkt) => {
    const {cmd} = pkt;
    switch(cmd) {
      case 'IDENT':
        return {
          "cmd": "JOIN",
          "msg": name
        };
      case 'SHOOT':
        return {
          "cmd": "GUESS",
          "msg": PLAYS[Math.floor(Math.random() * 3)]
        };
      default:
        return {
          "cmd": "unknown",
          "msg": "I don't know what you're asking me!"
        }
    }
  }

  client.on('data', (data) => {
    console.log(data.toString());
    let pkt = JSON.parse(data.toString());

    const response = processCommand(pkt);

    console.dir(response);

    client.write(JSON.stringify(response));
    // client.write(player.guess() + '\n');

  });
}
