const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { User, Match } = require('./database');
const clients = require('./clients');
const LevelModelGenerator = require('./LevelModelGenerator');
const CLIENT_ID = process.env.CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);
const Difficulty = require('./Difficulty');
const router = express.Router();
const matchmakingQueue = [];

async function verify(idToken) {
  const ticket = await client.verifyIdToken({
    idToken: idToken,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return payload;
}

async function matchPlayers() {
  if (matchmakingQueue.length < 2) return;

  for (let i = 0; i < matchmakingQueue.length - 1; i++) {
    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      const player1 = matchmakingQueue[i];
      const player2 = matchmakingQueue[j];
      if (Math.abs(player1.mmr - player2.mmr) <= 1000) {
        const match = await Match.create({
          player1Id: player1.googleId,
          player2Id: player2.googleId,
        });

        notifyClientsAboutMatch(player1, player2, match);

        matchmakingQueue.splice(j, 1);
        matchmakingQueue.splice(i, 1);

        handleMatchConfirmation(match, player1, player2);

        return;
      }
    }
  }
}

function notifyClientsAboutMatch(player1, player2, match) {
  const matchFoundMessage = {
    type: 'matchFound',
    matchId: match.id,
    opponent: null,
  };

  if (clients[player1.googleId]) {
    matchFoundMessage.opponent = player2.googleId;
    clients[player1.googleId].send(JSON.stringify(matchFoundMessage));
  }
  if (clients[player2.googleId]) {
    matchFoundMessage.opponent = player1.googleId;
    clients[player2.googleId].send(JSON.stringify(matchFoundMessage));
  }
}

async function handleMatchConfirmation(match, player1, player2) {
  setTimeout(async () => {
    const updatedMatch = await Match.findOne({ where: { id: match.id } });
    if (!updatedMatch.player1Confirmed || !updatedMatch.player2Confirmed) {
      await cancelMatch(updatedMatch, player1, player2);
    } else {
      await activateMatch(updatedMatch, player1, player2);
    }
  }, 5000);
}

async function cancelMatch(updatedMatch, player1, player2) {
  updatedMatch.status = 'cancelled';
  await updatedMatch.save();

  notifyClientsAboutMatchCancellation(updatedMatch, player1, player2);

  if (updatedMatch.player1Confirmed) matchmakingQueue.push(player1);
  if (updatedMatch.player2Confirmed) matchmakingQueue.push(player2);
}

function notifyClientsAboutMatchCancellation(updatedMatch, player1, player2) {
  const matchCancelledMessage = {
    type: 'matchCancelled',
    matchId: updatedMatch.id,
  };

  if (clients[player1.googleId]) {
    clients[player1.googleId].send(JSON.stringify(matchCancelledMessage));
  }
  if (clients[player2.googleId]) {
    clients[player2.googleId].send(JSON.stringify(matchCancelledMessage));
  }
}

async function activateMatch(updatedMatch, player1, player2) {
  updatedMatch.status = 'active';
  await updatedMatch.save();

  notifyClientsAboutMatchActivation(updatedMatch);

  setTimeout(async () => {
    const generator = new LevelModelGenerator();
    const difficulty = Difficulty.MEDIUM;
    const seed = Math.floor(Math.random() * 1000000);
    const levelModel = generator.generate(difficulty, seed);

    notifyClientsAboutLevelModel(updatedMatch, levelModel);

    setTimeout(async () => {
      await completeMatch(updatedMatch);
    }, (levelModel.time + 5) * 1000);
  }, 5000);
}

function notifyClientsAboutMatchActivation(updatedMatch) {
  const matchActiveMessage = {
    type: 'matchActive',
    matchId: updatedMatch.id,
  };

  if (clients[updatedMatch.player1Id]) {
    clients[updatedMatch.player1Id].send(JSON.stringify(matchActiveMessage));
  }
  if (clients[updatedMatch.player2Id]) {
    clients[updatedMatch.player2Id].send(JSON.stringify(matchActiveMessage));
  }
}

function notifyClientsAboutLevelModel(updatedMatch, levelModel) {
  const levelModelMessage = {
    type: 'levelModel',
    model: JSON.stringify(levelModel)
  };

  if (clients[updatedMatch.player1Id]) {
    clients[updatedMatch.player1Id].send(JSON.stringify(levelModelMessage));
  }
  if (clients[updatedMatch.player2Id]) {
    clients[updatedMatch.player2Id].send(JSON.stringify(levelModelMessage));
  }
}

async function completeMatch(updatedMatch) {
  const finalMatch = await Match.findOne({ where: { id: updatedMatch.id } });
  if (finalMatch) {
    finalMatch.status = 'completed';
    await finalMatch.save();

    notifyClientsAboutMatchCompletion(finalMatch);

    const delta1 = calculateMmr(finalMatch.player1Score, finalMatch.player2Score);
    const delta2 = calculateMmr(finalMatch.player2Score, finalMatch.player1Score);

    await updatePlayerMmr(finalMatch.player1Id, delta1);
    await updatePlayerMmr(finalMatch.player2Id, delta2);

    notifyClientsAboutMmrChange(finalMatch, delta1, delta2);
  }
}

function notifyClientsAboutMatchCompletion(finalMatch) {
  if (clients[finalMatch.player1Id]) {
    clients[finalMatch.player1Id].send(JSON.stringify({
      type: 'enemyScore',
      enemyScore: finalMatch.player2Score,
    }));
  }
  if (clients[finalMatch.player2Id]) {
    clients[finalMatch.player2Id].send(JSON.stringify({
      type: 'enemyScore',
      enemyScore: finalMatch.player1Score,
    }));
  }
}

function notifyClientsAboutMmrChange(finalMatch, delta1, delta2) {
  if (clients[finalMatch.player1Id]) {
    clients[finalMatch.player1Id].send(JSON.stringify({
      type: 'changeMmr',
      you: delta1,
      enemy: delta2,
    }));
  }
  if (clients[finalMatch.player2Id]) {
    clients[finalMatch.player2Id].send(JSON.stringify({
      type: 'changeMmr',
      you: delta2,
      enemy: delta1,
    }));
  }
}

function calculateMmr(score1, score2) {
  try{
    return score1 < score2 ? (score1 / (score1 + score2)) * -100 : (score1 / (score1 + score2)) * 100;
  }catch(error){
    return 0;
  }
}

async function updatePlayerMmr(playerId, delta) {
  const player = await User.findOne({ where: { googleId: playerId } });
  if (player) {
    player.mmr += delta;
    await player.save();
  }
}
setInterval(matchPlayers, 5000);

async function handleMessage(message) {
  try {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'confirmMatch':
        await confirmMatch(data.idToken, data.matchId);
        break;
      case 'declineMatch':
        await declineMatch(data.idToken, data.matchId);
        break;
      case 'sendScore':
        await handleScoreSubmission(data.idToken, data.matchId, data.score);
        break;
    }
  } catch (err) {
    console.error('Failed to handle message:', err);
  }
}

async function confirmMatch(idToken, matchId) {
  const payload = await verify(idToken);
  const user = await User.findOne({ where: { googleId: payload.sub } });
  const match = await Match.findOne({ where: { id: matchId } });

  if (user && match) {
    if (match.player1Id === user.googleId) {
      match.player1Confirmed = true;
    } else if (match.player2Id === user.googleId) {
      match.player2Confirmed = true;
    } else {
      sendError(user.googleId, 'Вы не являетесь участником этого матча');
      return;
    }
    await match.save();
    if (clients[user.googleId]) {
      clients[user.googleId].send(JSON.stringify({ type: 'matchConfirmed', match }));
    }
  } else {
    sendError(user.googleId, 'Матч или пользователь не найдены');
  }
}
async function declineMatch(idToken, matchId) {
  const payload = await verify(idToken);
  const user = await User.findOne({ where: { googleId: payload.sub } });
  const match = await Match.findOne({ where: { id: matchId } });

  if (user && match) {
    if (match.player1Id === user.googleId || match.player2Id === user.googleId) {
      match.status = 'cancelled';
      await match.save();
      notifyClientsAboutMatchCancellation(match, match.player1Id, match.player2Id);
    } else {
      sendError(user.googleId, 'Вы не являетесь участником этого матча');
    }
  } else {
    sendError(user.googleId, 'Матч или пользователь не найдены');
  }
}

async function handleScoreSubmission(idToken, matchId, score) {
  const payload = await verify(idToken);
  const user = await User.findOne({ where: { googleId: payload.sub } });
  const match = await Match.findOne({ where: { id: matchId } });

  if (user && match) {
    if (match.player1Id === user.googleId) {
      match.player1Score = score;
    } else if (match.player2Id === user.googleId) {
      match.player2Score = score;
    } else {
      sendError(user.googleId, 'Вы не являетесь участником этого матча');
      return;
    }
    await match.save();
    if (clients[user.googleId]) {
      clients[user.googleId].send(JSON.stringify({ type: 'scoreReceived', matchId: match.id, score }));
    }
    if (match.player1Score !== -1 && match.player2Score !== -1) {
      await completeMatch(match);
    }
  } else {
    sendError(user.googleId, 'Матч или пользователь не найдены');
  }
}

function sendError(googleId, message) {
  if (clients[googleId]) {
    clients[googleId].send(JSON.stringify({ type: 'error', message }));
  }
}

router.post('/joinQueue', async (req, res) => {
  const tokenId = req.query.tokenId;
  try {
    const payload = await verify(tokenId);
    const user = await User.findOne({ where: { googleId: payload.sub } });

    if (user) {
      matchmakingQueue.push(user);
      res.status(200).json({ message: 'Добавлено в очередь матчмейкинга' });
    } else {
      res.status(404).json({ message: 'Пользователь не найден' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Аутентификация не удалась', error: error.message });
  }
});

router.post('/leaveQueue', async (req, res) => {
  const tokenId = req.query.tokenId;
  try {
    const payload = await verify(tokenId);
    const user = await User.findOne({ where: { googleId: payload.sub } });

    if (user) {
      const index = matchmakingQueue.findIndex(u => u.googleId === user.googleId);
      if (index > -1) {
        matchmakingQueue.splice(index, 1);
        res.status(200).json({ message: 'Удалено из очереди матчмейкинга' });
      } else {
        res.status(400).json({ message: 'Пользователь не найден в очереди' });
      }
    } else {
      res.status(404).json({ message: 'Пользователь не найден' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Аутентификация не удалась', error: error.message });
  }
});

module.exports = {
  router,
  matchPlayers,
  handleMessage,
};
