require('dotenv').config();
const express = require('express');
const http = require('http');
const { OAuth2Client } = require('google-auth-library');
const { sequelize } = require('./database');
const WebSocket = require('ws');
const profileRouter = require('./profiles');
const { router: matchRouter, handleMessage } = require('./matches');
const CLIENT_ID = process.env.CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);



const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ port: 8080 });

const clients = require('./clients');


app.use(express.json());

async function verify(idToken) {
  const ticket = await client.verifyIdToken({
    idToken: idToken,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return payload;
}

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.split('?')[1]);
  const tokenId = params.get('tokenId');

  verify(tokenId).then(payload => {
    const userId = payload.sub;
    clients[userId] = ws;

    ws.on('message', (message) => {
      handleMessage(message);
    });

    ws.on('close', () => {
      delete clients[userId];
    });

    ws.send(JSON.stringify({ message: 'connected', type: 'connection' })); // Отправляем сообщение в формате JSON
  }).catch(err => {
    ws.close();
  });
});


app.use('/profiles', profileRouter);
app.use('/matches', matchRouter);

const port = process.env.PORT || 3000;
server.listen(port, async () => {
  await sequelize.authenticate();
  console.log(`Server started on port ${port}`);
});
