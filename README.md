# Video Conferencing Platform

A comprehensive WebRTC-based video conferencing platform built with Next.js, TypeScript, Redux, and mediasoup client. This application provides a feature-rich video collaboration experience similar to popular video conferencing tools.

## Features

- **Multi-participant Video/Audio Communication**

  - Real-time video and audio conferencing
  - Support for multiple participants in the same room
  - Active speaker detection

- **Media Controls**

  - Microphone muting/unmuting
  - Camera enabling/disabling/switching
  - Screen sharing capability
  - Audio-only mode for bandwidth conservation
  - Remote audio muting

- **Advanced WebRTC Features**

  - Simulcast for bandwidth efficiency
  - Spatial and temporal layering
  - Connection statistics monitoring
  - ICE restart capability
  - Network throttling for testing

- **User Interface**

  - Responsive layout with video grid
  - Display name customization
  - Device detection and information display
  - Visual indicators for connection states
  - Optional face detection

- **Chat Features**
  - Text chat between participants
  - Support for "bot" messages via data channels

## Technologies Used

- **Frontend**

  - Next.js
  - TypeScript
  - React
  - Redux Toolkit
  - SCSS

- **WebRTC & Signaling**

  - mediasoup-client
  - protoo-client for WebSocket communication

- **Utilities**
  - face-api.js for optional face detection
  - hark for audio level detection
  - UUID for unique identifiers
  - js-cookie for state persistence

## Getting Started

### Prerequisites

- Node.js 14.x or later
- npm or yarn
- A mediasoup server (or compatible WebRTC SFU)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/video-conferencing-platform.git
   cd video-conferencing-platform
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root directory with the following variables:

   ```
   MEDIASOUP_WEBSOCKET_URL=wss://your-mediasoup-server.com/ws
   ```

4. Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. Enter your API URL and API Key on the login screen
2. Enter or generate a Room ID
3. Set your display name
4. Click "Join Room" to enter the video conference
5. Use the controls to manage your audio/video, share your screen, or chat with other participants

## Backend Requirements

This application requires a compatible mediasoup server with the following capabilities:

- WebSocket signaling using the protoo library
- Room creation and management
- Support for WebRTC transport establishment
- Producer and consumer handling
- Data channel support for chat functionality

The server should expose endpoints for:

- Authentication and token generation
- WebSocket connection URLs

## Project Structure

```
video-conferencing-platform/
├── components/         # React components
├── contexts/           # React contexts
├── pages/              # Next.js pages
│   ├── api/            # API routes
│   └── index.tsx       # Main page
├── public/             # Static assets
│   ├── icons/          # UI icons
│   └── models/         # face-api.js models
├── redux/              # Redux state management
├── services/           # Core WebRTC services
├── styles/             # SCSS stylesheets
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- This project was inspired by the [mediasoup-demo](https://github.com/versatica/mediasoup-demo) application
- Thanks to the [mediasoup](https://mediasoup.org/) team for their excellent WebRTC SFU
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) for the face detection capabilities
