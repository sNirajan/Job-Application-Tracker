/*
 * Cookie configuration.
 *
 * Centralizes all cookie options so they're consistent across
 * login, refresh, and logout. When clearing cookies, the path,
 * domain, secure, and sameSite must EXACTLY match the options
 * used when setting them, otherwise the browser won't clear them.
 */

// This code file itself does not set or clear cookies; it only prepares the options used when our controller does that.

const config = require("./index");

// In production with different domains, we need SameSite=None + Secure
// In development on localhost, SameSite=Lax works

const isProduction = config.isProduction;

const ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: "/",
};

const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/"
};

// For clearing cookies, same options but maxAge = 0
// CRITICAL: path, secure, sameSite MUST match the set options
const CLEAR_ACCESS_COOKIE = {...ACCESS_COOKIE_OPTIONS, maxAge:0 };
const CLEAR_REFRESH_COOKIE = {...REFRESH_COOKIE_OPTIONS, maxAge:0 };

module.exports = {
    ACCESS_COOKIE_OPTIONS,
    REFRESH_COOKIE_OPTIONS,
    CLEAR_ACCESS_COOKIE,
    CLEAR_REFRESH_COOKIE
}
