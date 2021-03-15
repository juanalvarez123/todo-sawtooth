const crypto = require('crypto')
const _ = require('underscore');
const {
  InvalidTransaction
} = require('sawtooth-sdk/processor/exceptions');

const TP_FAMILY = 'auth';
const TP_VERSION = '1.0';

const hash512 = (x) =>
  crypto.createHash('sha512').update(x).digest('hex');

const TP_NAMESPACE = hash512(TP_FAMILY).substring(0, 6)

const addressIntKey = (key) => {
  return TP_NAMESPACE + hash512(key).slice(-64)
}
addressIntKey.keysCanCollide = true;


const handlers = {
  async put([context], {transaction, txid}){

    const {type, publicKey, permissions} = JSON.parse(transaction);
    
    if (!type || type !== 'auth') {
      throw new InvalidTransaction('type must be auth');
    }
    if(!_.isString(publicKey)){
      throw new InvalidTransaction('publicKey must be a string');
    }

    if(publicKey !== context.publicKey){
      throw new InvalidTransaction('bad signature')
    }

    if(!_.isArray(permissions) || !_.all(permissions, p => _.isString(p))){
      throw new InvalidTransaction('permissions must be an [] of strings')
    }

    await context.putState(publicKey, permissions);

    return;
  }
};

module.exports = {TP_FAMILY, TP_VERSION, TP_NAMESPACE, handlers, addresses:[addressIntKey]};