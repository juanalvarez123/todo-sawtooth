require('dotenv').config()
const _ = require('underscore');
const fs = require('fs');
const mongo = require('./src/mongodb/mongo');


// mongoClient.db('mydb').collection("customers").insertOne({'data': 'data'});
const blockCollectionPromise = mongo.client().then((client) => {
  return client.db('mydb').collection('block');
});

const transactionCollectionPromise = mongo.client().then((client) => {
  return client.db('mydb').collection('transaction');
});

const stateCollectionPromise = mongo.client().then((client) => {
  return client.db('mydb').collection('state');
});

const sawtoothHelper = require('./src/sawtooth/sawtooth-helpers');

const crypto = require('crypto');
const hash512 = (x) =>
  crypto.createHash('sha512').update(x).digest('hex');
const PREFIX = hash512("todos").substring(0, 6);

const {
  EventFilter,  
} = require('sawtooth-sdk/protobuf');
const { default: axios } = require('axios');
const { reject } = require('underscore');
const { resolve } = require('path');

const BLOCKS_FILE = '../server/data/blocks.json';
const STATE_FILE = '../server/data/state.json';
const CURRENT_STATE_FILE = '../server/data/current_state.json';


let blocks = [];
let state = {};
let current_state = {}; //If forks never happen, this might be the only data necessary to store.

(async () => {
  blocks = await readFile(BLOCKS_FILE) || [];
  state = await readFile(STATE_FILE) || {};

  // const lastBlock = (blocks.length > 0)? blocks[blocks.length - 1].block_id: sawtoothHelper.NULL_BLOCK_ID;
  const lastBlock = sawtoothHelper.NULL_BLOCK_ID;

  sawtoothHelper.subscribeToSawtoothEvents(handlers, lastBlock);
})();


async function blockCommitHandler(block, events){
  // console.log(block);

  //https://github.com/hyperledger-archives/sawtooth-supply-chain/blob/master/ledger_sync/db/blocks.js
  // If the blockNum did not already exist, or had the same id
  // there is no fork, return the block
  
  let blockByNum = await findBlockByNum(block.block_num);
  
  if(!blockByNum || blockByNum.block_id === block.block_id ){ //No fork
    await addState(block, events);
    current_state = updateCurrentState(current_state, block);

    await addTransactions(block);
  }
  else{ // Fork
    console.log('FORK!!')
    //Remove invalid data
    await removeTransactionsAfterBlockNumInclusive(block.block_num);
    await removeStateAfterBlockNumInclusive(block.block_num);

    state = _.mapObject(state, (v, k) => {
      return _.filter(v, e => {
        e.block_num < block.block_num
      });
    });


    state = addState(block, events);
    current_state = {};
    _.forEach(blocks, (b) => {
      current_state = updateCurrentState(current_state, b);
    });

    await addTransactions(block);
  }

  await writeFile(BLOCKS_FILE, blocks);
  await writeFile(STATE_FILE, state);
  await writeFile(CURRENT_STATE_FILE, current_state);
}

async function findBlockByNum(block_num){
  const blockCollection = await blockCollectionPromise;
  return await blockCollection.findOne({block_num});

  // let blockByNum = _.find(blocks, (b)=> b.block_num === block.block_num);
}


async function addTransactions(block){

  const blockCollection = await blockCollectionPromise;
  const txCollection = await transactionCollectionPromise;

  const tb = getTransactionsFromBlock(block);

  for(n = 0; n < tb.length; n++){
    const t = tb[n];
    let p = JSON.parse(t.payload);

    let t_new = _.clone(t);
    t_new._id = t_new.txid;

    if(p.input){
      let prev = await txCollection.findOne({_id: p.input});
      t_new.input = prev._id;
      t_new.root = prev.root;
      t_new.idx = prev.idx + 1;
    }
    else{
      t_new.input = null;
      t_new.root = t_new.txid;
      t_new.idx = 0;
    }
    await txCollection.updateOne({_id: t_new._id}, {$set: t_new}, {upsert: true});
    
  }

  await blockCollection.updateOne({_id: block.block_id},{$set:{_id: block.block_id, ...block}}, {upsert: true});
  blocks.push(block);
  lastBlock = block.block_id;

}

async function removeTransactionsAfterBlockNumInclusive(block_num){
  const blockCollection = await blockCollectionPromise;
  const txCollection = await transactionCollectionPromise;

  await blockCollection.deleteMany({block_num: {$gte: block_num}});
  await blockCollection.deleteMany({block_num: {$gte: block_num}});

  blocks = _.filter(blocks, (b) => {
    b.block_num < block.block_num
  });
}


async function removeStateAfterBlockNumInclusive(block_num){
  const stateCollection = await stateCollectionPromise;
  await stateCollection.deleteMany({block_num: {$gte: block_num}});

}

/*
'sawtooth/state-delta' must be used with 'sawtooth/block-commit'
*/
const handlers = [
  {
    eventType: 'sawtooth/state-delta',
    filters: [{
      key: 'address',
      matchString: `^${PREFIX}.*`,
      filterType: EventFilter.FilterType.REGEX_ANY
    }],
    handle: null,
  },
  {
    eventType: 'sawtooth/block-commit',
    filters: [],
    handle: blockCommitHandler
  },
  // {
  //   eventType: 'myevent',
  //   filters: [],
  //   handle: (e) => console.log(e) 
  // }
]


function getSawtoothTransactionsFromBlock(block) {
  return _.chain(block.batches)
    .map(b => {
      return _.map(b.transactions, t => {
        let payload;
        try {
          payload = JSON.parse(Buffer.from(t.payload, 'base64').toString('utf-8'));
        }
        catch (err) {
          payload = Buffer.from(t.payload, 'base64').toString('utf-8');
        }
        return {
          block_id: block.block_id,
          block_num: block.block_num,
          batch_id: b.header_signature,
          transaction_id: t.header_signature,
          payload: payload,
          family_name: t.header.family_name
        };
      });
    })
    .flatten()
    .filter(t => t.family_name === 'todos')
    // .indexBy(t => t.payload.args.txid)
    .value();
}


function getSawtoothTransactions(allBlocks){
  return _.chain(allBlocks)
  .map(block => {
    return getSawtoothTransactionsFromBlock(block);
  })
  .flatten()
  // .filter(t => t.family_name === 'todos')
  .value();
}

function getTransactionsFromBlock(block){
  const sawtoothT = getSawtoothTransactionsFromBlock(block);
  return _.map(sawtoothT, sawtoothTransactionToTransaction);
}

function getTransactions(allBlocks){
  const sawtoothT = getSawtoothTransactions(allBlocks);
  return _.map(sawtoothT, sawtoothTransactionToTransaction);
}

function sawtoothTransactionToTransaction(t){
  const payload = t.payload.args.transaction;
  const txid = t.payload.args.txid;
  return {
    payload,
    txid,

    block_id: t.block_id,
    block_num: t.block_num,
    batch_id: t.batch_id,
    transaction_id: t.transaction_id,
    // family_name: t.family_name
  };
}

// function addState(block, events){
//   _.forEach(events, (e) => {      
//     let prev = state[e.address];
//     if(!prev){
//       state[e.address] = []
//     }
//     state[e.address].push({
//       address: e.address,
//       block_num: block.block_num,
//       value: e.value.toString('utf-8'),
//       type: e.type
//     });
//   });
//   return state;
// }

async function addState(block, events){

  const stateCollection = await stateCollectionPromise;

  for(n = 0; n < events.length; n++){
    const e = events[n];
    const address = e.address;

    let prevState = {};
    const cursor = await stateCollection.find({address}).sort({block_num: -1}).limit(1);
    await new Promise((resolve, reject) => {
      cursor.forEach((doc)=>{
        prevState[doc.address] = doc;
      }, 
      resolve)
    });

    let toDelete = [];

    if(e.type == 'DELETE'){
      toDelete = _.keys(prevState);
    }
    else if(e.type == 'SET'){
      const p = JSON.parse(e.value.toString('utf-8'));
      let updates = {}
      for(m = 0; m < p.length; m++){
        const {key, value} = p[m];
        updates[key] = value;
  
        await stateCollection.updateOne({address, key, block_num: block.block_num}, {$set: {
          address,
          key,
          block_num: block.block_num,
          value,
          type: 'SET'
        }}, 
        {upsert: true});
      }
  
      toDelete = _.difference(_.keys(prevState), _.keys(updates));
      console.log(toDelete);
    }
    else{
      //
    }

    for(m = 0; m < toDelete.length; m ++){
      const k = toDelete[m];
      await stateCollection.updateOne({address, key:k, block_num: block.block_num}, {$set: {
        address,
        key:k,
        block_num: block.block_num,
        value: null,
        type: 'DELETE'
      }}, 
      {upsert: true});
    }

  }
}


function updateCurrentState(_current_state, block){

  let transactions = getTransactionsFromBlock(block);
  _.forEach(transactions, t => { 
    let history = [t];

    let current = JSON.parse(t.payload).input;

    while(current != null){
      if(_current_state[current]){
        history = _current_state[current].concat(history)
        delete _current_state[current];
        break;
      }

      history.unshift(_current_state[current]);

      current = JSON.parse(
        _current_state[current][_current_state[current].length - 1].payalod
      ).input;
    }

    _current_state[t.txid] = history;
  });
  
  
  return _current_state;
}

function writeFile(file, jsonObject){
  return new Promise((resolve, reject) => {
    fs.writeFile(file, JSON.stringify(jsonObject, null, 4), (err) => {
      if(err){
        return reject(err);
      }
      return resolve();
    });
  })
}

function readFile(file){
  return new Promise((resolve, reject) => {
    fs.readFile(file, (err, data) =>{
      if(err){
        resolve(null);
      }
      try{
        let p = JSON.parse(data);
        return resolve(p);
      }
      catch(e){
        resolve(null);
      }
    });
  });
}




//=============================================


let startshutdown = false;
async function shutdown(){
  if(startshutdown){
    return;
  }
  startshutdown = true;

  return new Promise((resolve, reject) => {
    let end = false;
    const finish = (err) => {
      if(!end){
        if(err){
          console.log(err.message);
          resolve();
        }
        console.log('shut down normally');
        resolve();
      }
      end = true;
    };

    (async () => {
      await mongo.close();
      await writeFile(BLOCKS_FILE, blocks);
      await writeFile(STATE_FILE, state);
      await sawtoothHelper.close();
      finish();
    })();

    setTimeout(() => finish(new Error('Timeout')), 2000);
  });  
}

process.on('SIGINT', async () => {
  // await console.log('SIGINT')
  await shutdown();
  // process.kill(process.pid, 'SIGUSR2');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  // process.kill(process.pid, 'SIGUSR2');
  process.exit(0);
});

process.once('SIGUSR2', async () => {
  await shutdown();
  console.log('kill');
  // process.kill(process.pid, 'SIGUSR2');
  process.exit(0);
});
