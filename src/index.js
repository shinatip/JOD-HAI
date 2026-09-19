require('dotenv').config();
const express = require('express');
const { line, config } = require('./config/line');
const userService = require('./services/userService');
const textHandler = require('./handlers/textHandler');
const postbackHandler = require('./handlers/postbackHandler');

const app = express();

app.get('/', (_req, res) => res.send('LINE credit card tracker bot is running.'));

app.post('/webhook', line.middleware(config), async (req, res) => {
  // Respond to LINE immediately; process events after.
  res.status(200).end();

  const events = req.body.events || [];
  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error('Error handling event:', err);
    }
  }
});

async function handleEvent(event) {
  if (!event.source || !event.source.userId) return;

  const lineUserId = event.source.userId;
  const user = await userService.getOrCreateUser(lineUserId);
  // console.log(`[event.type]= ${event.type} | type=${event.message.type}`);
// console.log(`handleEvent:  event=${JSON.stringify(event)}`);

  if (event.type === 'message' && event.message.type === 'text') {
    return textHandler.handle(event, user);
  }
  if (event.type === 'postback') {
    return postbackHandler.handle(event, user);
  }
  if (event.type === 'follow') {
    return textHandler.handle({ ...event, message: { type: 'text', text: 'menu' } }, user);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Bot server listening on port ${port}`));
