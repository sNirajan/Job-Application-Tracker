const authService = require("../services/auth.service");
const {
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  CLEAR_ACCESS_COOKIE,
  CLEAR_REFRESH_COOKIE,
} = require("../config/cookies");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.validated);
  // No tokens on register, user must log in
  res.status(201).json({ data: user });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated);

  // Sets tokens as HttpOnly cookies
  res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

  // Only user info in the response body, tokens never in JSON
  res.json({ data: { user: result.user } });
});

const refreshToken = asyncHandler(async (req, res) => {
  // Reads refresh token from cookie
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "No refresh token" },
    });
  }

  // Rotation: old token invalidated, new tokens generated
  const result = await authService.refresh(token);

  // Sets new cookies (both — refresh token rotated)
  res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.json({ data: { message: "Token refreshed" } });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  // Invalidates the refresh token in Redis
  await authService.logout(req.userId, token);

  // Clears cookies, options MUST match what was set
  res.cookie("accessToken", "", CLEAR_ACCESS_COOKIE);
  res.cookie("refreshToken", "", CLEAR_REFRESH_COOKIE);

  res.json({ data: { message: "Logged out" } });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.userId);
  res.json({ data: user });
});

module.exports = { register, login, refreshToken, logout, getMe };