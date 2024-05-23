import { http } from 'msw'
import { setupWorker } from 'msw/browser'
import { factory, oneOf, manyOf, primaryKey } from '@mswjs/data'
import { nanoid } from '@reduxjs/toolkit'
import faker from 'faker'
import seedrandom from 'seedrandom'
import { Server as MockSocketServer } from 'mock-socket'
import { setRandom } from 'txtgen'
import { parseISO } from 'date-fns'

const NUM_USERS = 3
const POSTS_PER_USER = 3
const RECENT_NOTIFICATIONS_DAYS = 7

const ARTIFICIAL_DELAY_MS = 2000

let useSeededRNG = true
let rng = seedrandom()

if (useSeededRNG) {
  let randomSeedString = localStorage.getItem('randomTimestampSeed')
  let seedDate

  if (randomSeedString) {
    seedDate = new Date(randomSeedString)
  } else {
    seedDate = new Date()
    randomSeedString = seedDate.toISOString()
    localStorage.setItem('randomTimestampSeed', randomSeedString)
  }

  rng = seedrandom(randomSeedString)
  setRandom(rng)
  faker.seed(seedDate.getTime())
}

function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(rng() * (max - min + 1)) + min
}

const randomFromArray = (array) => {
  const index = getRandomInt(0, array.length - 1)
  return array[index]
}

export const db = factory({
  user: {
    id: primaryKey(nanoid),
    firstName: String,
    lastName: String,
    name: String,
    username: String,
    posts: manyOf('post'),
  },
  post: {
    id: primaryKey(nanoid),
    title: String,
    date: String,
    content: String,
    reactions: oneOf('reaction'),
    comments: manyOf('comment'),
    user: oneOf('user'),
  },
  comment: {
    id: primaryKey(String),
    date: String,
    text: String,
    post: oneOf('post'),
  },
  reaction: {
    id: primaryKey(nanoid),
    thumbsUp: Number,
    hooray: Number,
    heart: Number,
    rocket: Number,
    eyes: Number,
    post: oneOf('post'),
  },
})

const createUserData = () => {
  const firstName = faker.name.firstName()
  const lastName = faker.name.lastName()
  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    username: faker.internet.userName(),
  }
}

const createPostData = (user) => {
  return {
    title: faker.lorem.words(),
    date: faker.date.recent(RECENT_NOTIFICATIONS_DAYS).toISOString(),
    user,
    content: faker.lorem.paragraphs(),
    reactions: db.reaction.create(),
  }
}

for (let i = 0; i < NUM_USERS; i++) {
  const author = db.user.create(createUserData())
  for (let j = 0; j < POSTS_PER_USER; j++) {
    const newPost = createPostData(author)
    db.post.create(newPost)
  }
}

const serializePost = (post) => ({
  ...post,
  user: post.user.id,
})

export const handlers = [
  http.get('/fakeApi/posts', (req, res, ctx) => {
    const posts = db.post.getAll().map(serializePost)
    return res(ctx.delay(ARTIFICIAL_DELAY_MS), ctx.json(posts))
  }),
  http.post('/fakeApi/posts', (req, res, ctx) => {
    const data = req.body

    if (data.content === 'error') {
      return res(
        ctx.delay(ARTIFICIAL_DELAY_MS),
        ctx.status(500),
        ctx.json('Server error saving this post!')
      )
    }

    data.date = new Date().toISOString()
    const user = db.user.findFirst({ where: { id: { equals: data.user } } })
    data.user = user
    data.reactions = db.reaction.create()
    const post = db.post.create(data)
    return res(ctx.delay(ARTIFICIAL_DELAY_MS), ctx.json(serializePost(post)))
  }),
  http.get('/fakeApi/posts/:postId', (req, res, ctx) => {
    const post = db.post.findFirst({
      where: { id: { equals: req.params.postId } },
    })
    return res(ctx.delay(ARTIFICIAL_DELAY_MS), ctx.json(serializePost(post)))
  }),
  http.patch('/fakeApi/posts/:postId', (req, res, ctx) => {
    const { id, ...data } = req.body
    const updatedPost = db.post.update({
      where: { id: { equals: req.params.postId } },
      data,
    })
    return res(ctx.delay(ARTIFICIAL_DELAY_MS), ctx.json(serializePost(updatedPost)))
  }),
  http.get('/fakeApi/posts/:postId/comments', (req, res, ctx) => {
    const post = db.post.findFirst({
      where: { id: { equals: req.params.postId } },
    })
    return res(ctx.delay(ARTIFICIAL_DELAY_MS), ctx.json({ comments: post.comments }))
  }),
  http.post('/fakeApi/posts/:postId/reactions', (req, res, ctx) => {
    const postId = req.params.postId
    const reaction = req.body.reaction
    const post = db.post.findFirst({
      where: { id: { equals: postId } },
    })
    const updatedPost = db.post.update({
      where: { id: { equals: postId } },
      data: {
        reactions: {
          ...post.reactions,
          [reaction]: (post.reactions[reaction] += 1),
        },
      },
    })
    return res(ctx.delay(ARTIFICIAL_DELAY_MS), ctx.json(serializePost(updatedPost)))
  }),
  http.get('/fakeApi/notifications', (req, res, ctx) => {
    const numNotifications = getRandomInt(1, 5)
    let notifications = generateRandomNotifications(undefined, numNotifications, db)
    return res(ctx.delay(ARTIFICIAL_DELAY_MS), ctx.json(notifications))
  }),
  http.get('/fakeApi/users', (req, res, ctx) => {
    return res(ctx.delay(ARTIFICIAL_DELAY_MS), ctx.json(db.user.getAll()))
  }),
]

export const worker = setupWorker(...handlers)

const socketServer = new MockSocketServer('ws://localhost')
let currentSocket

const sendMessage = (socket, obj) => {
  socket.send(JSON.stringify(obj))
}

const sendRandomNotifications = (socket, since) => {
  const numNotifications = getRandomInt(1, 5)
  const notifications = generateRandomNotifications(since, numNotifications, db)
  sendMessage(socket, { type: 'notifications', payload: notifications })
}

export const forceGenerateNotifications = (since) => {
  sendRandomNotifications(currentSocket, since)
}

socketServer.on('connection', (socket) => {
  currentSocket = socket
  socket.on('message', (data) => {
    const message = JSON.parse(data)
    switch (message.type) {
      case 'notifications': {
        const since = message.payload
        sendRandomNotifications(socket, since)
        break
      }
      default:
        break
    }
  })
})

const notificationTemplates = [
  'poked you',
  'says hi!',
  `is glad we're friends`,
  'sent you a gift',
]

function generateRandomNotifications(since, numNotifications, db) {
  const now = new Date()
  let pastDate
  if (since) {
    pastDate = parseISO(since)
  } else {
    pastDate = new Date(now.valueOf())
    pastDate.setMinutes(pastDate.getMinutes() - 15)
  }
  const notifications = [...Array(numNotifications)].map(() => {
    const user = randomFromArray(db.user.getAll())
    const template = randomFromArray(notificationTemplates)
    return {
      id: nanoid(),
      date: faker.date.between(pastDate, now).toISOString(),
      message: template,
      user: user.id,
    }
  })
  return notifications
}
