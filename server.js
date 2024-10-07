//server.js
const https = require('https');
const fs = require('fs');
const express = require('express');
const passport = require('./passport');
const session = require('express-session');
const flash = require('connect-flash'); // connect-flash 불러오기
require('dotenv').config();

const app = express();

// HTTPS 서버용 SSL 인증서 읽기
const privateKey = fs.readFileSync('ssh/key.pem', 'utf8');
const certificate = fs.readFileSync('ssh/cert.pem', 'utf8');

const credentials = { key: privateKey, cert: certificate };

// 요청 본문 파싱 미들웨어 추가 (반드시 세션 설정보다 먼저 와야 함)
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.COOKIE_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }  // HTTPS가 아닌 환경에서는 false로 설정
  }));

app.use(flash()); // connect-flash 미들웨어 추가

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());


  

// 로그인 요청 라우터
app.get('/login', (req, res, next) => {
    passport.authenticate('azuread-openidconnect')(req, res, next);
  });

// 로그인 콜백 처리
// app.post('/auth/callback',
//   passport.authenticate('azure_ad_oauth2', {
//     failureMessage: true   // 실패 시 메시지 출력
//   }),
//   function(req, res) {
//     console.log(req.user); // 인증된 사용자 정보를 출력
//     res.redirect('/main'); // 성공적으로 로그인 후 메인 페이지로 이동
//   }
// );

// server.js

app.post('/auth/callback',
  passport.authenticate('azuread-openidconnect', {
    successRedirect: '/main',
    failureRedirect: '/auth/error',
    failureFlash: true
  })
);



app.get('/main', ensureAuthenticated, (req, res) => {
  res.send(`Hello ${req.user.name}, you accessed via GET!`);
});

app.post('/main', ensureAuthenticated, (req, res) => {
  res.send(`Hello ${req.user.name}, you accessed via POST!`);
});
  

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// HTTPS 서버 시작
https.createServer(credentials, app).listen(3000, () => {
  console.log("HTTPS Server is running on port 3000");
});