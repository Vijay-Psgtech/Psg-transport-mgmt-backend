import jwt from 'jsonwebtoken';

export const REFRESH_COOKIE = 'refreshToken';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export const signAccessToken = (user) =>
  jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || '15m',
  });

export const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_TTL || '7d',
  });

// If the API and frontend are on different sites in production, use sameSite: 'none' (requires HTTPS)
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/api/auth',
});

export const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), maxAge: SEVEN_DAYS });

export const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, cookieOptions());
