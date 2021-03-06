/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const bunyan = require('bunyan'),
  _ = require('lodash'),
  config = require('../../config'),
  buildCoins = require('../../utils/coins/buildCoins'),
  models = require('../../models'),
  sem = require('semaphore')(1),
  log = bunyan.createLogger({name: 'app.utils.addUnconfirmedTx', level: config.logs.level});

/**
 * @function
 * @description add unconfirmed tx to cache
 * @param tx - unconfirmed transaction
 * @returns {Promise.<*>}
 */

const addTx = async (tx) => {

  tx = {
    _id: tx.hash,
    index: tx.index,
    size: tx.hex.length / 2,
    blockNumber: -1,
    timestamp: Date.now(),
    inputs: tx.inputs,
    outputs: tx.outputs
  };

  const coins = buildCoins([tx]);

  tx = _.omit(tx, ['inputs', 'outputs']);

  log.info(`inserting unconfirmed tx ${tx._id}`);
  await models.txModel.create(tx);

  log.info(`inserting unconfirmed ${coins.length} coins`);
  if (coins.length) {
    let bulkOps = coins.map(coin => ({
      updateOne: {
        filter: {_id: coin._id},
        update: {$set: coin},
        upsert: true
      }
    }));

    await models.coinModel.bulkWrite(bulkOps);
  }

};

module.exports = async (tx) => {

  return await new Promise((res, rej) => {
    sem.take(async () => {
      try {
        await addTx(tx);
        res();
      } catch (err) {
        rej(err);
      }

      sem.leave();
    });
  });

};
