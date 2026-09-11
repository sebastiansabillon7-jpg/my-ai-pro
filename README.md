# My AI Pro — browser AI assistant

This is a website, not a mobile app. It runs in a browser and uses an OpenAI API key on the server.

## Start locally

1. Install Node.js.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Set `OPENAI_API_KEY` in your environment.
5. Run `npm start`.
6. Open `http://localhost:3000`.

### macOS / Linux
`export OPENAI_API_KEY="your_key_here"`

### Windows PowerShell
`$env:OPENAI_API_KEY="your_key_here"`

Never put your API key in the `public` folder.

## Features

- ChatGPT-style responsive interface
- New chat
- Local browser chat history
- Search chats
- Rename/delete chats
- Dark/light theme
- Copy responses
- Regenerate last response
- Stop generation
- Keyboard shortcuts
- Mobile sidebar
- Server-side OpenAI API call
- No database required for the starter version

## Publishing

Deploy the Node server to a service that supports Node.js. Add `OPENAI_API_KEY` as a server/environment secret. Do not publish the API key in frontend JavaScript.
