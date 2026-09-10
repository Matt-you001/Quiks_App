/*
 * Public Paddle checkout configuration for Quiks School.
 * Paddle client tokens and price IDs are designed to be public. Never put a
 * Paddle API key, RevenueCat secret, webhook secret, or Firebase service key here.
 */
window.QUIKS_SCHOOL_PADDLE_CONFIG = {
  enabled: false,
  environment: "production",
  apiBaseUrl: "https://quiks-app.onrender.com",
  clientToken: "live_e2230dece339e0887253584a161",
  prices: {
    "per-learner": { term: "pri_01m22sf7c2yapaxmrsqvcc4q26", session: "pri_01m23awdptxksm2xxwkv1pcy6y" },
    starter: { term: "pri_01m22zx25r919nw4xgcnshxpet", session: "pri_01m2309pdzp0kf8s4ccrcemt6d" },
    growth: { term: "pri_01m231caaj1z0fn97rppasvmfm", session: "pri_01m231pt3qdw4gr25jzwv8taev" },
    complete: { term: "pri_01m231zmgwx166gnx1dtnnqxrs", session: "pri_01m232j0rbgyfdvf4gvz1sheb8" },
    enterprise: { term: "pri_01m232tp79qtbh6w4p9y8v1d0h", session: "pri_01m2335zfhpsxgame479sf0tz2" }
  }
};
