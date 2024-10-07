// passport.js
const passport = require('passport');
const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
require('dotenv').config();

passport.use('azuread-openidconnect',new OIDCStrategy({
  identityMetadata: `https://login.microsoftonline.com/1f09ca7a-519d-45d8-a5cb-c2631b0f7358/v2.0/.well-known/openid-configuration`,
  clientID: process.env.AZURE_CLIENT_ID, // Azure 포털에서 발급받은 클라이언트 ID
  clientSecret: process.env.AZURE_CLIENT_SECRET, // 클라이언트 시크릿
  responseType: 'code',
  responseMode: 'form_post',
  redirectUrl: 'http://192.168.77.80:3000/auth/callback', // 콜백 URL
  allowHttpForRedirectUrl: true, // HTTPS가 아니라 HTTP로 개발할 경우 true
  validateIssuer: true,
  passReqToCallback: true,
  scope: ['openid','profile', 'email', 'offline_access'],
  // loggingLevel: 'debug'
},
function(req, iss, sub, profile, accessToken, refreshToken, params, done) {
  if (!profile.oid) {
    return done(new Error("No OID found"), null);
  }
  // 필요한 경우 사용자 정보를 저장하거나 업데이트
  return done(null, profile);
}));

// passport.js
passport.serializeUser(function(user, done) {
  done(null, user); 
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

module.exports = passport;
