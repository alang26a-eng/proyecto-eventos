import passport from 'passport';
import { Strategy } from 'passport-custom';
import cookie from 'cookie';
import * as auth from '../services/auth.service.js';

const strategy = verify => new Strategy((req, done) => {
  Promise.resolve().then(() => verify(req)).then(user => done(null, user), done);
});
passport.use('register', strategy(req => auth.registerUser(req.body)));
passport.use('login', strategy(req => auth.loginUser(req.body)));
passport.use('current', strategy(req => auth.currentIdentity(cookie.parse(req.headers.cookie || '').currentUser)));
passport.use('access', strategy(req => {
  const header = req.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  const token = match?.[1] || (!header && cookie.parse(req.headers.cookie || '').currentUser);
  return auth.accessIdentity(token);
}));
// Nuevos providers se registran aquí; las reglas de negocio viven en services.
export default passport;