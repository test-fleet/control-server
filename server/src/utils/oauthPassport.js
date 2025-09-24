const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const MicrosoftStrategy = require('passport-microsoft').Strategy
const GithubStrategy = require('passport-github2').Strategy
const OktaStrategy = require('passport-okta-oauth').Strategy
const { findOrCreateOAuthUser } = require('../services/auth.service')
const { NotFoundError } = require('./appError')

function setupPassport() {
  const provider = process.env.OAUTH_PROVIDER?.toLowerCase()
  const config = {
    clientID: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    callbackURL: process.env.OAUTH_REDIRECT_URL,
  }

  const verify = async (accessToken, refreshToken, profile, done) => {
    try {
      const userInfo = extractUserInfo(profile);

      if (!userInfo.email) {
        return done(new NotFoundError('No email returned by OAuth provider'));
      }

      const user = await findOrCreateOAuthUser(userInfo);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }

  function extractUserInfo(profile) {
    switch (profile.provider) {
      case 'google':
        return {
          email: profile.emails[0]?.value,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value
        }
      case 'github':
        return {
          email: profile.emails?.[0]?.value || profile._json?.email,
          name: profile.displayName || profile.username,
          avatar: profile.photos?.[0]?.value
        }
      case 'microsoft':
        return {
          email: profile.mail || profile.userPrincipalName,
          name: profile.displayName,
          avatar: null
        }
      case 'okta':
        return {
          email: profile.emails?.[0]?.value,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value
        }
      default:
        throw new Error(`Unsupported provider: ${profile.provider}`)
    }
  }

  switch (provider) {
    case 'google':
      passport.use(new GoogleStrategy(config, verify))
      break
    case 'microsoft':
      passport.use(new MicrosoftStrategy(config, verify))
      break
    case 'github':
      passport.use(new GithubStrategy(config, verify))
      break
    case 'okta':
      passport.use(new OktaStrategy({
        ...config,
        issuer: `https://${process.env.OKTA_DOMAIN}/oauth2/default`
      }, verify))
      break
    default:
      throw new Error(`Unsupported OAUTH_PROVIDER: ${provider}`)
  }

  // Serialize user.id in session (or JWT)
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser((id, done) => {
    // TODO: fetch user from DB by id
    done(null, { id })
  })
}

module.exports = { setupPassport }
