import Twit from 'twit'
import 'dotenv/config'
import { DateTime } from 'luxon'
import { nanoid } from 'nanoid'
import { get, sum } from 'lodash'
import db from '../db'

export const Twitter = new Twit({
  consumer_key: process.env.T_CONSUMER_KEY,
  consumer_secret: process.env.T_CONSUMER_KEY_SECRET,
  access_token: process.env.T_ACCESS_TOKEN,
  access_token_secret: process.env.T_ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  // strictSSL: true, // optional - requires SSL certificates to be valid.
})

export const openTwitterStream = (ctx, args) => {
  var stream = Twitter.stream('statuses/filter', { track: args.q })
  stream.on('error', () => stream.stop())

  stream.on('tweet', (tweet) => {
    const trendingCause = getPreparedTrendFromTweets([tweet], args.q)
    ctx.websocket.send(JSON.stringify(trendingCause))
  })
}

const getPreparedTrendByKeyword = (keyword) => {
  const rawTrend = db.get('trendingCauses').find({ keyword }).value()
  if (!rawTrend) {
    return null
  }
  const score = Math.floor(rawTrend.sumScore / rawTrend.count)
  return {
    id: rawTrend.id,
    name: keyword,
    value: score,
    maxValue: score,
    isSelected: false,
    color: getTrendColor(score),
  }
}

export const getPreparedTrendFromTweets = (tweets, keyword) => {
  const scoreObjects = tweets.map((t) => getScoreFromTweet(t, keyword))
  const sumScore = sum(scoreObjects)
  const count = get(scoreObjects, 'length', 0)
  const existingCause = db.get('trendingCauses').find({ keyword })
  const existingCauseValue = existingCause.value()
  if (!existingCauseValue) {
    db.get('trendingCauses')
      .push({
        id: nanoid(),
        keyword,
        sumScore,
        count,
      })
      .write()
  } else {
    existingCause
      .assign({
        sumScore: existingCauseValue.sumScore + sumScore,
        count: existingCauseValue.count + count,
      })
      .write()
  }
  return getPreparedTrendByKeyword(keyword)
}

const getScoreFromTweet = (tweet) => {
  const currDate = DateTime.local()
  const tweetDate = DateTime.fromFormat(
    tweet.created_at,
    'EEE MMM dd HH:mm:ss ZZZ yyyy'
  )
  const likeScore = parseInt(tweet.favorite_count, 10) * 0.2
  const rtScore = parseInt(tweet.retweet_count, 10) * 0.3
  const timeScore =
    currDate.minus({ seconds: tweetDate.toSeconds() }).toSeconds() * 0.5

  let finalScore = Math.floor(likeScore + rtScore + timeScore)

  if (finalScore < 0) {
    return 0
  }

  return finalScore
}

const getTrendColor = (score) => {
  switch (true) {
    case score < 10:
      return '#602BD0'
    case score < 20:
      return '#2353FF'
    case score < 30:
      return '#53A3ED'
    case score < 40:
      return '#32DAFF'
    case score < 80:
      return '#00FFC2'
    case score < 100:
      return '#5EFD81'
    case score < 120:
      return '#C8F34E'
    case score < 160:
      return '#E5E922'
    case score < 200:
      return '#FFCD4C'
    default:
      return '#FF4D4D'
  }
}
