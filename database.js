const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite' 
});

const User = sequelize.define('User', {
  googleId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  desc: {
    type: DataTypes.STRING,
  },
  img: {
    type: DataTypes.STRING,
  },
  friendlist: {
    type: DataTypes.TEXT, 
    get() {
      const rawValue = this.getDataValue('friendlist');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('friendlist', JSON.stringify(value));
    }
  },
  mmr: {
    type: DataTypes.INTEGER,
  },
});


const Match = sequelize.define('Match', {
  player1Id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  player2Id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  player1Confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  player2Confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
  },
	player1Score: {
      type: DataTypes.INTEGER,
      defaultValue: -1 
    },
    player2Score: {
      type: DataTypes.INTEGER,
      defaultValue: -1 
    }
  });
sequelize.sync();

module.exports = {
  sequelize,
  User,
  Match
};
