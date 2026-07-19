const jwt = require('jsonwebtoken')
const passport = require('passport')
const { UnauthorizedError } = require('../utils/appError')

function oauthLogin(req, res, next) {
  try {
    const provider = process.env.OAUTH_PROVIDER?.toLowerCase();
    console.log("provider: ", provider);
    let scope;
    const options = {session: false}

    switch (provider) {
      case 'google':
        scope = ['email', 'profile'];
        options.prompt = 'select_account'; // prompt account select
        break;
      case 'microsoft':
        scope = ['User.Read'];
        break;
      case 'github':
        scope = ['user:email'];
        break;
      case 'okta':
        scope = ['openid', 'profile', 'email'];
        break;
      default:
        return next(new Error(`Unsupported OAUTH_PROVIDER: ${provider}`));
    }

    options.scope = scope
    passport.authenticate(provider, options)(req, res, next);
  } catch (err) {
    next(err);
  }
}

function oauthCallback(req, res, next) {
  passport.authenticate(process.env.OAUTH_PROVIDER, { session: false }, async (err, user) => {
    try {
      if (err) return next(err);
      if (!user) return next(new UnauthorizedError('OAuth login failed'));

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );
      res.redirect(`/auth/callback?token=${token}`);
    } catch (err) {
      next(err);
    }
  })(req, res, next);
}

function logout(req, res) {
  res.cookie('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });

  res.json({ success: true, message: 'Delete client jwt' })
}

function me(req, res, next) {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'))
    res.json({
      id: req.user._id,
      email: req.user.email,
      userName: req.user.userName,
      avatar: req.user.avatar,
      role: req.user.role,
      status: req.user.status,
      lastLogin: req.user.lastLogin,
    })
  } catch (err) {
    console.log("err: ", err)
    next(err)
  }
}

module.exports = { oauthLogin, oauthCallback, logout, me }
