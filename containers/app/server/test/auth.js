require('dotenv').config();

const express = require('express');
const app = require('../app');
const mongo = require('../mongodb/mongo');
const {
  privKey1, 
  privKey2, 
  getPublicKey, 
  buildTransaction, 
  sleep,
  jwtSign,
  jwtVerify
} = require('./helper');
const request = require('supertest');
const _ = require('underscore');

const {sign} = require('../helpers/signature')

//https://mochajs.org
//https://www.chaijs.com/guide/styles/#assert
const assert = require('chai').assert;

const jwtHeader = 'Bearer ' + jwtSign({publicKey: getPublicKey(privKey1)});


describe('/auth/', ()=>{
  
  after(async () => {
    await sleep(50);
    mongo.close();
  });

  it('challange', async ()=>{
    let t1 = Date.now();
    let res = await request(app)
      .post('/auth/challange')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(200);
      
    assert.isNotNull(res.body.challange);

    let j = await jwtVerify(res.body.challange);
    assert.isTrue(j.challange >= t1);
  });

  it('signup bad email', async ()=>{

    let res = await request(app)
      .post('/auth/challange')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(200);

    // let s = buildTransaction({email: "a@a.com", publicKey: getPublicKey(privKey1), challange: res.body.challange}, privKey1);
    let s = await buildTransaction({publicKey: getPublicKey(privKey1), challange: res.body.challange}, privKey1);

    res = await request(app)
      .post('/auth/signup')
      .send(s)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(401);

    assert.deepEqual(res.body, 'email is required')
  });

  it.only('signup', async ()=>{

    let res = await request(app)
      .post('/auth/challange')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(200);

    let s = await buildTransaction({email: "a@a.com", publicKey: getPublicKey(privKey1), challange: res.body.challange}, privKey1);

    res = await request(app)
      .post('/auth/signup')
      .send(s)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(200);

    assert.isNotNull(res.body.token);
    let j = await jwtVerify(res.body.token);

    assert.equal(j.publicKey, getPublicKey(privKey1));

  });


});