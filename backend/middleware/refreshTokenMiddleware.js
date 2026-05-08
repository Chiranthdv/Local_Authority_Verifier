const REFRESH_TOKEN_COOKIE = "refreshToken";

function extractToken(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCookies(cookieHeader) {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) {
    return {};
  }

  return cookieHeader.split(";").reduce((acc, pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return acc;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

module.exports = (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = extractToken(cookies[REFRESH_TOKEN_COOKIE]) || extractToken(req.body?.refreshToken);

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  req.refreshToken = refreshToken;
  return next();
};
