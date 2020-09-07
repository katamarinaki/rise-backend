import Twit from 'twit'
import 'dotenv/config'
import { DateTime } from 'luxon'
import { nanoid } from 'nanoid'
import { get, random, sum } from 'lodash'
import db from '@src/db'

export const Twitter = new Twit({
  consumer_key: process.env.T_CONSUMER_KEY,
  consumer_secret: process.env.T_CONSUMER_KEY_SECRET,
  access_token: process.env.T_ACCESS_TOKEN,
  access_token_secret: process.env.T_ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  // strictSSL: true, // optional - requires SSL certificates to be valid.
})

export const getTweets = (ctx) => {
  const keywords = db.get('keywords').value()
  keywords.map((keyword) =>
    Twitter.get('search/tweets', {
      q: keyword,
      count: 10,
      include_entities: false,
      include_rts: false,
      include_user_entities: false,
    })
      .then((d) => {
        const tweets = get(d.data, 'statuses')
        if (!tweets) {
          throw 'No tweets found'
        }
        const trendingCause = getPreparedTrendFromTweets(tweets, keyword)
        ctx.websocket.send(JSON.stringify(trendingCause))
      })
      .catch((err) => {
        throw err
      })
  )
  openTwitterStream(ctx, keywords)
}

const openTwitterStream = (ctx, keywords) => {
  const mergedKeyword = keywords.join(',')
  const stream = Twitter.stream('statuses/filter', { track: mergedKeyword })
  stream.on('error', () => stream.stop())
  ctx.websocket.on('close', () => {
    stream.stop()
  })
  stream.on('tweet', (tweet) => {
    const foundKeywords = keywords.filter((kw) => tweet.text.includes(kw))
    foundKeywords.map((foundKeyword) => {
      const trendingCause = getPreparedTrendFromTweets([tweet], foundKeyword)
      ctx.websocket.send(JSON.stringify(trendingCause))
    })
  })
}

const getPreparedTrendByKeyword = (keyword) => {
  const rawTrend = db.get('trendingCauses').find({ keyword }).value()
  if (!rawTrend) {
    return null
  }
  const score = Math.floor(rawTrend.sumScore + rawTrend.count * 0.5)
  return {
    id: rawTrend.id,
    name: keyword,
    value: score,
    color: getTrendColor(),
  }
}

const getPreparedTrendFromTweets = (tweets, keyword) => {
  const scoreObjects = tweets.map((t) => getScoreFromTweet(t, keyword))
  const count = get(scoreObjects, 'length', 0)
  const sumScore = sum(scoreObjects) + count * 10
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
    (currDate.minus({ seconds: tweetDate.toSeconds() }).toSeconds() / 60) * 0.5

  let finalScore = Math.floor((likeScore + rtScore + timeScore) / 100)

  if (finalScore < 0) {
    return 0
  }

  return finalScore
}

const getTrendColor = () => {
  const colors = [
    '#602BD0',
    '#2353FF',
    '#53A3ED',
    '#32DAFF',
    '#00FFC2',
    '#5EFD81',
    '#C8F34E',
    '#E5E922',
    '#FFCD4C',
    '#FF4D4D',
  ]
  return colors[random(0, colors.length - 1, false)]
}
