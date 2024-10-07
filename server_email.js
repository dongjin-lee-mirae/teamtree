
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const https = require('https');
const session = require('express-session');

require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// HTTPS 서버용 SSL 인증서 읽기
const privateKey = fs.readFileSync('ssh/key.pem', 'utf8');
const certificate = fs.readFileSync('ssh/cert.pem', 'utf8');

const credentials = { key: privateKey, cert: certificate };

// 세션 확인 미들웨어
function isAuthenticated(req, res, next) {
  if (req.session && req.session.email) {
    return next(); // 세션이 유효하면 다음으로 넘어감
  } else {
    // 세션이 유효하지 않으면 로그인 페이지로 리디렉션
    return res.redirect('/login');
  }
}

// Nodemailer 설정
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 이메일 도메인 확인 함수
function isValidEmail(email) {
  const domain = email.split('@')[1];
  return domain === 'miraeasset.com';
}

// 이메일 전송 시간을 저장하는 객체 (임시로 서버 메모리 사용)
const emailSendTimestamps = {};

// 이메일 전송 함수 호출 제한 시간 (60초)
const EMAIL_SEND_LIMIT = 60 * 1000; // 1분 (밀리초)

// 이메일 전송 함수
async function sendConfirmationEmail(userEmail, token) {
  const confirmationUrl = `http://localhost:${PORT}/confirm/${token}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: '[Miraeasset Security TeamTree] A login authentication key has been created.',
    html: `
      <p>A login authentication key has been created. Please click the link below to confirm your login:</p>
      <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
      <br>
      <div style="font-size:14px; color:#333;">
        <strong>Team Tree | Global IT Team</strong><br>
        <span style="color: #666;">Mirae Asset Global IT</span><br>
        36F, Tower1, 33 Jong-ro, Jongno-gu, Seoul, 03159, Republic of Korea<br>
        <a href="https://miraeasset.com" style="color: orange;">miraeasset.com</a>
        <br><br>
        <p style="font-size:12px; color:#999;">
        This email and any attachments transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. 
        If you are not the intended recipient, please advise the sender immediately by reply email and permanently delete this transmission. 
        Please note that any views or opinions presented in this email are solely those of the author and do not necessarily represent those of the company. 
        The information and attachment contained in this email are intended for business use only, and sent and received emails could be stored for the purpose of business. 
        Finally, the recipient should check this email and any attachments for the presence of viruses. 
        The company/sender accepts no liability for any damage caused by any virus transmitted by this email.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// 제한 시간 후 메모리에서 기록을 제거하는 함수
function clearEmailTimestamp(email) {
  setTimeout(() => {
    delete emailSendTimestamps[email];
    console.log(`Email timestamp for ${email} cleared from memory`);
  }, EMAIL_SEND_LIMIT);
}


// JWT 토큰 생성 함수
function generateToken(email) {
  return jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '3d' });
}

// JWT 토큰 확인 함수
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// // HTTPS 서버 생성
// https.createServer(credentials, app).listen(PORT, () => {
//   console.log(`HTTPS server running on port ${PORT}`);
// });

// HTTP 서버 생성
app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key', // 세션 암호화를 위한 비밀 키
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24시간 동안 세션 유지
}));

// 에러 알림 이메일 발송
async function sendErrorEmail(errorMessage) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'admin@example.com', // 관리자 이메일 주소
    subject: 'Server Error Alert',
    text: `An error occurred on the server: ${errorMessage}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Error email sent successfully.');
  } catch (error) {
    console.error('Failed to send error email:', error);
  }
}

// 에러 핸들러 미들웨어 추가
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  
  // 이메일 발송 함수 호출 (오류 정보를 포함한 이메일을 보냄)
  sendErrorEmail(err.message);

  res.status(500).json({ message: 'Internal Server Error' });
});

// 로그인 라우터
app.get('/login/:email', async (req, res) => {
  const { email } = req.params;

  // 세션 확인
  if (req.session && req.session.email) {
    console.log(`User ${req.session.email} already logged in. Redirecting to /main.`);
   // 세션이 유효하면 메인 페이지로 리디렉션
    return res.redirect('/main');
  }

  const currentTime = Date.now();

  console.log(`login email ${email}`);
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email domain' });
  }

  // 마지막 이메일 전송 시간 확인
  if (emailSendTimestamps[email] && currentTime - emailSendTimestamps[email] < EMAIL_SEND_LIMIT) {
    const remainingTime = Math.ceil((EMAIL_SEND_LIMIT - (currentTime - emailSendTimestamps[email])) / 1000);
    return res.status(429).json({ message: `Please wait ${remainingTime} seconds before requesting another email.` });
  }

  // 토큰 생성 및 이메일 전송
  const token = generateToken(email);
  await sendConfirmationEmail(email, token);

  // 이메일 전송 시간 업데이트
  emailSendTimestamps[email] = currentTime;

  // 제한 시간이 지나면 메모리에서 해당 이메일 기록을 삭제
  clearEmailTimestamp(email);

  res.status(200).json({ message: 'Confirmation email sent' });
});

// 이메일 확인 라우터
app.get('/confirm/:token', (req, res) => {
  const { token } = req.params;
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
  console.log(`Email ${decoded.email} confirmed!`);

  // 세션 생성
  req.session.email = decoded.email;

  // 이메일이 확인되면 /main 경로로 리디렉션
  res.redirect('/main');
});

// /main 라우터
app.get('/main', isAuthenticated, (req, res) => {
  res.send('Welcome to the main page!');
});