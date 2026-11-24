console.log('Loading passport...');
const passport = require('/mnt/d/Mailora/reachinbox/node_modules/passport');
console.log('Loading GoogleStrategy...');
const { Strategy: GoogleStrategy } = require('/mnt/d/Mailora/reachinbox/node_modules/passport-google-oauth20');
console.log('Creating strategy with empty credentials...');
passport.use(new GoogleStrategy(
  { clientID: '', clientSecret: '', callbackURL: 'http://localhost:3001/callback' },
  (at, rt, profile, done) => done(null, profile)
));
console.log('Strategy created OK');
setTimeout(() => { console.log('Done'); process.exit(0); }, 500);
