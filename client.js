const net = require('net');
const readline = require('readline');
const debug = require('debug')('client');
const debugv = require('debug')('client:verbose');

const rdln = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

const guess = () => {
  return new Promise((resolve) => {
    rdln.question('Shoot... ', (resp) => {
      debug('response: ', resp);
      resolve(resp.trim());
    });
  });
};

const tryAgain = () => {
  return new Promise((resolve) => {
    rdln.question('Go another round...(y/n)? ', (resp) => {
      debug('response: ', resp);
      resolve(resp.trim());
    });
  });
};

debug('created readline');
debugv('rl is', rdln);

rdln.question('What\'s your name? ', (resp) => {
  debug('question response: ', resp);
  runClient(resp.trim());
});

const runClient = (name) => {
  const client = net.connect({port: 5432});

  const processCommand = (pkt) => {
    return new Promise((resolve) => {
      const {cmd} = pkt;

      switch(cmd) {
        case 'IDENT':
          resolve({
            cmd: 'JOIN',
            msg: name
          });
          return;

        case 'SHOOT':
          return guess()
            .then((resp) => {
              resolve({
                cmd: 'GUESS',
                msg: resp
              });
            });

        case 'TRY_AGAIN':
          return tryAgain()
            .then((resp) => {
              resolve({
                cmd: 'TRY_AGAIN',
                msg: resp
              });
            });

        default:
          resolve({
            cmd: 'unknown',
            msg: 'I don\'t know what you\'re asking me!'
          });
          return;
      }
    });
  };

  client.on('data', (data) => {
    let pkt = JSON.parse(data.toString());

    processCommand(pkt)
      .then((response) => {
        client.write(JSON.stringify(response));

        if (response.action === 'TRY_AGAIN') {
          const anotherRound = String(response.msg).trim().toLowerCase().indexOf(0) !== 'n';
          if (!anotherRound) {
            rdln.close();
            client.destroy();
          }
        }
      })
      .catch((err) => {
        debug('process command', 'error', err);
      });
  });
};
