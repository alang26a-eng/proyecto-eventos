import passport from '../config/passport.config.js';
export const authenticate = passport.authenticate('access', { session: false });
