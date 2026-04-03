/* Auth controller */

const authService = require("../services/auth.service");

const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const register = asyncHandler(async (req, res) => {
    const user = await authService.register(req.validated);
    res.status(201).json({ data: user });
}); 

const login = asyncHandler(async (req, res) => {
    const result = await authService.login(req.validated);
    res.json({ data: result});
});

const refreshToken = asyncHandler(async (req, res) => {
    const token = await authService.refresh(req.validated);
    res.json({ data: token})
})
module.exports = { register, login, refreshToken };