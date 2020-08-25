import Twit from 'twit'
import 'dotenv/config'

export const Twitter = new Twit({
  consumer_key: process.env.T_CONSUMER_KEY,
  consumer_secret: process.env.T_CONSUMER_KEY_SECRET,
  access_token: process.env.T_ACCESS_TOKEN,
  access_token_secret: process.env.T_ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  // strictSSL: true, // optional - requires SSL certificates to be valid.
})
