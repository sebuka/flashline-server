const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { User } = require('./database');
const CLIENT_ID = process.env.CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);
const router = express.Router();

async function verify(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_ID,
  });
  return ticket.getPayload();
}

async function getRating(mmr) {
  try {
    const users = await User.findAll({ order: [['mmr', 'DESC']] });
    let low = 0;
    let high = users.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (users[mid].mmr === mmr) {
        return mid + 1;
      } else if (users[mid].mmr < mmr) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting rting:', error);
    throw error;
  }
}

router.post('/authenticate', async (req, res) => {
  const idToken = req.body.idToken;
  try {
    const payload = await verify(idToken);
    const [user, created] = await User.findOrCreate({
      where: { googleId: payload.sub },
      defaults: {
        googleId: payload.sub,
        name: payload.name,
        desc: '',
        img: payload.picture,
        friendlist: [],
        mmr: 1000,
      },
    });
    res.status(200).json({ message: 'Authentication successful', user });
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed', error: error.message });
  }
});

router.get('/profile', async (req, res) => {
  const googleId = req.query.googleId;
  try {
    const user = await User.findOne({ where: { googleId } });
    console.log(user);
    if (user) {
      const rating = await getRating(user.mmr);
      const userWithRating = { ...user.toJSON(), rating };
      res.status(200).json({ user: userWithRating });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
    console.log( error.message);
  }
});

router.post('/updateProfile', async (req, res) => {
  const idToken = req.query.idToken;
  const { name, desc } = req.body;
  try {
    const payload = await verify(idToken);
    const user = await User.findOne({ where: { googleId: payload.sub } });

    if (user) {
      user.name = name;
      user.desc = desc;
      await user.save();
      res.status(200).json({ message: 'Profile updated successful' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed', error: error.message });
  }
});

router.post('/addFriend', async (req, res) => {
  const { tokenId, googleId } = req.body;
  try {
    const payload = await verify(tokenId);
    const user = await User.findOne({ where: { googleId: payload.sub } });
    const friend = await User.findOne({ where: { googleId } });

    if (user && friend) {
      const friendList = user.friendlist || [];
      if (!friendList.includes(googleId)) {
        friendList.push(googleId);
        user.friendlist = friendList;
        await user.save();
        res.status(200).json({ message: 'Friend added successfully' });
      } else {
        res.status(400).json({ message: 'Friend already added' });
      }
    } else {
      res.status(404).json({ message: 'User or friend not found' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed', error: error.message });
  }
});

router.post('/deleteFriend', async (req, res) => {
  const { tokenId, googleId } = req.body;
  try {
    const payload = await verify(tokenId);
    const user = await User.findOne({ where: { googleId: payload.sub } });

    if (user) {
      const friendList = user.friendlist || [];
      const index = friendList.indexOf(googleId);
      if (index > -1) {
        friendList.splice(index, 1);
        user.friendlist = friendList;
        await user.save();
        res.status(200).json({ message: 'Friend deleted successfully' });
      } else {
        res.status(400).json({ message: 'Friend not found in the list' });
      }
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed', error: error.message });
  }
});

router.get('/getRating', async (req, res) => {
  try {
    const topUsers = await User.findAll({
      order: [['mmr', 'DESC']],
      limit: 100,
    });
    const topGoogleIds = topUsers.map(user => user.googleId);
    res.status(200).json({ topGoogleIds });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;
