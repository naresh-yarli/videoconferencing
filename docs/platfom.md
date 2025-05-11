# Video Conferencing Platform Architecture

## Overview

This Next.js/TypeScript application implements a full-featured WebRTC video conferencing platform using mediasoup. The architecture follows modern patterns with React Hooks, TypeScript, and modular design principles.

## Core Components

### Client-Side Architecture

1. **Core Services**

   - `WebRTCService` - Central service for mediasoup client connection management
   - `RoomClient` - High-level abstraction managing a room connection
   - `DeviceManager` - Handles device detection and capabilities
   - `MediaManager` - Manages media streams, tracks, and devices

2. **State Management**

   - Redux store with slices for:
     - Room state
     - Participants
     - Media devices
     - Media producers/consumers
     - Transports
     - UI state

3. **React Components**

   - Room (container)
   - Participants Grid
   - Local Participant
   - Remote Participant
   - Media Controls
   - Chat Panel
   - Settings Panel
   - Statistics View

4. **Hooks**
   - `useRoom` - Room connection management
   - `useMedia` - Media handling
   - `useDevices` - Device detection
   - `useChat` - Chat functionality
   - `useStats` - Statistics collection

### Communication Protocol

The platform uses a layered communication approach:

1. **Authentication Layer**

   - API Key authentication for room access
   - JWT tokens for secure WebSocket connections

2. **Signaling Layer**

   - Protoo client for WebSocket communication
   - Event-based signaling protocol

3. **Media Transport Layer**
   - WebRTC via mediasoup client
   - RTP capabilities negotiation
   - Producer/consumer management

## Key Features Implementation

| Feature                 | Implementation Approach                         |
| ----------------------- | ----------------------------------------------- |
| Multi-participant video | Dynamic consumer creation with grid layout      |
| Audio/video controls    | Local producer management with UI controls      |
| Screen sharing          | Additional producer with specialized encoding   |
| Chat messaging          | Data channels with protoo notification system   |
| Device selection        | MediaDevices API with device switching          |
| Connection statistics   | Real-time stats collection via mediasoup        |
| Bandwidth management    | Simulcast and SVC layer control                 |
| Face detection          | Optional client-side processing via face-api.js |
| Network throttling      | Development tool for connection testing         |

## Data Flow

1. **Room Connection**

   ```
   User → Auth → WebSocket Connection → Room Join → RTP Capabilities Exchange
   ```

2. **Media Publishing**

   ```
   Local Media → Producer Creation → Transport Connection → Server-side Router → Other Participants
   ```

3. **Media Consumption**
   ```
   Server Notification → Consumer Creation → Transport Connection → Local Media Rendering
   ```

## Deployment Architecture

The application is designed for deployment in a Next.js environment:

- Client components: React components running in the browser
- API routes: Next.js API routes for authentication and initial signaling
- External services: Mediasoup server running separately
