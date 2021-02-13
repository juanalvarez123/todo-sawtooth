'use strict'

const _ = require('underscore')
const { TransactionHandler } = require('sawtooth-sdk/processor/handler')
const {
  InvalidTransaction,
  InternalError
} = require('sawtooth-sdk/processor/exceptions')

async function getRawState(context, addressRaw){
  let possibleAddressValues = await context.getState([addressRaw])
  let stateValueRep = possibleAddressValues[addressRaw]

  if (!stateValueRep || stateValueRep.length == 0) {
    return;
  }
  return stateValueRep;
}

async function getState(context, address, key){
  const rawState = await getRawState(context, address(key));
  if(_.isUndefined(rawState)){
    return;
  }

  let values = JSON.parse(Buffer.from(rawState, 'utf8').toString())
  if(!_.isArray(values)){
    throw new InvalidTransaction('State Error')
  }

  let f = _.find(values, (v) => {
    return v.key === key
  });
  if(f){
    return f.value;
  }
  return;
}


async function putState(context, address, key, value){
  const rawState = await getRawState(context, address(key));
  let toSave;
  if(_.isUndefined(rawState)){
    toSave = [{key, value}] 
  }
  else{
    let values = JSON.parse(Buffer.from(rawState, 'utf8').toString())
    if(!_.isArray(values)){
      throw new InvalidTransaction('State Error')
    }

    let existed = false;
    for(let n = 0; n < values.length; n++){
      if(values[n].key === key){
        values[n].value = value;
        existed = true;
        break;
      }
    }
    if(!existed){
      values.push({key, value});
    }
    toSave = values;
  }

  let addresses = await context.setState({
    [address(key)]: Buffer.from(JSON.stringify(toSave), 'utf8')
  })

  if(addresses.length === 0){
    throw new InternalError('State Error!')
  }
}

async function deleteState(context, address, key, value){
  const rawState = await getRawState(context, address(key));
  let toSave;
  if(_.isUndefined(rawState)){
    toSave = [{key, value}] 
  }
  else{
    let values = JSON.parse(Buffer.from(rawState, 'utf8').toString())
    if(!_.isArray(values)){
      throw new InvalidTransaction('State Error')
    }
    toSave = _.filter(values, (v) => {
      v.key === key;
    });
  }

  let addresses = await context.setState({
    [address]: Buffer.from(JSON.stringify(toSave), 'utf8')
  })

  if(addresses.length === 0){
    throw new InternalError('State Error!')
  }
}

module.exports = function({TP_FAMILY, TP_VERSION, TP_NAMESPACE, handlers, address}){

  class TPHandler extends TransactionHandler {
    constructor () {
      super(TP_FAMILY, [TP_VERSION], [TP_NAMESPACE])
    }
  
    async apply (transactionProcessRequest, context) {    
      
      let payload = JSON.parse(Buffer.from(transactionProcessRequest.payload, 'utf8').toString());   
      const {func, params} = payload;
  
      if(!handlers[func]){
        throw new InvalidTransaction('Function does not exist')
      }
  
      const ctx = {
        getState: function(key){
          return getState(context, address, key);
        },
        putState: function(key, value){
          return putState(context, address, key, value);
        },
        deleteState: function(key){
          return deleteState(context, address, key);
        },
        addEvent: function(evetnType, attributes, data, timout){
          return context.addEvent(evetnType, attributes, data, timout);
        },
        context
      }
      
      await handlers[func](ctx, params);

    }
  }
  return TPHandler;
};

