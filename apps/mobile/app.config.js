const base = require("./app.json");

const expo = { ...base.expo };
const extra = { ...(expo.extra || {}) };
const eas = { ...(extra.eas || {}) };

if (process.env.EXPO_PUBLIC_API_URL) {
  extra.apiUrl = process.env.EXPO_PUBLIC_API_URL;
}

if (process.env.EAS_PROJECT_ID) {
  eas.projectId = process.env.EAS_PROJECT_ID;
}

extra.eas = eas;
expo.extra = extra;

if (process.env.EXPO_OWNER) {
  expo.owner = process.env.EXPO_OWNER;
}

module.exports = { expo };
