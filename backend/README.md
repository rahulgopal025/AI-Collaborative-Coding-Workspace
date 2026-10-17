# AI-Powered Collaborative Coding Workspace - Backend

![Node.js](https://img.shields.io/badge/Node.js-%2343853D.svg?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-%234EA94B.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-%23000000.svg?style=for-the-badge&logo=socket.io&logoColor=white)

This is the robust backend service for the **AI-Powered Collaborative Coding Workspace**, built with **Node.js**, **Express.js**, and **MongoDB**.

## 🚀 Features

### 🔐 Authentication & Security
- **JWT-based Authentication**: Secure session management using JSON Web Tokens
- **Password Hashing**: Robust password protection with bcrypt
- **Role-based Access Control**: 
  - `owner`: Full control over room (delete, invite, manage)
  - `editor`: Can edit code, chat, and vote
  - `viewer`: Read-only access to code
- **Rate Limiting**: Protects against brute-force and abuse

### 👥 Real-Time Collaboration
- **Socket.io Integration**: Real-time communication for instant updates
- **Live Code Sync**: Instant code changes across all connected clients
- **Multiplayer Editing**: Multiple users can edit the same file simultaneously

### 📊 Real-Time Analysis
- **Live Sentiment Analysis**: Real-time sentiment tracking of team discussions
- **Live Keyword Extraction**: Automatic keyword detection from chat
- **AI Code Suggestions**: Real-time code completion and error detection

### 📝 Feature Requests
- **Real-Time Voting**: Team members can upvote/downvote feature requests
- **Prioritization**: Automatic prioritization based on vote count
- **Status Tracking**: Track feature request status (pending, approved, implemented)

### 💬 Communication
- **Real-Time Chat**: Instant messaging within collaboration rooms
- **Message History**: Persisted chat messages for reference
- **Sentiment Analysis**: AI-powered analysis of conversation tone

### 📁 Project Management
- **File/Folder Structure**: Hierarchical file management within rooms
- **Create/Edit/Delete**: Full CRUD operations for files and folders
- **Real-Time Sync**: All file operations sync instantly across clients

### 🔧 IDE Simulation
- **Code Editor**: Built-in code editor with syntax highlighting (integrated with frontend)
- **AI Coding Assistant**: Real-time code suggestions and error checking
- **Terminal Commands**: Run shell commands and view output in real-time

## 📚 Tech Stack

- **Language**: JavaScript
- **Runtime**: Node.js
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/)
- **Real-Time**: [Socket.io](https://socket.io/)
- **Authentication**: JWT, bcrypt
- **AI Integration**: OpenAI API, Hugging Face Transformers (via AI-service)
- **Utilities**: Mongoose, cors, dotenv, nodemon

## 📂 Project Structure

```
backend/
├── config/
│   └── db.js             # Database connection configuration
├── controllers/
│   ├── authController.js # User authentication and management
│   ├── roomController.js # Room management
│   ├── codeController.js # File and folder operations
│   ├── chatController.js # Chat message handling
│   ├── aiController.js   # AI-powered features
│   └── featureController.js # Feature request management
├── models/
│   ├── User.js           # User schema and model
│   ├── Room.js           # Room schema and model
│   ├── Message.js        # Chat message schema
│   ├── FeatureRequest.js # Feature request schema
│   └── Index.js          # Database models entry point
├── routes/
│   ├── authRoutes.js     # Authentication routes
│   ├── roomRoutes.js     # Room routes
│   ├── codeRoutes.js     # Code routes
│   ├── chatRoutes.js     # Chat routes
│   ├── aiRoutes.js       # AI routes
│   └── featureRoutes.js  # Feature request routes
├── services/
│   ├── aiService.js      # AI-powered feature implementations
│   └── websocketService.js # Socket.io event handling
├── config/
│   ├── db.js             # Database connection configuration
├── .env.example          # Environment variable template
├── package.json          # Project dependencies
└── server.js             # Application entry point
```

## 🔌 API Endpoints

### 🔐 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and get JWT token |
| `GET` | `/api/auth/me` | Get current user profile |
| `PUT` | `/api/auth/profile` | Update user profile |
| `GET` | `/api/auth/all-users` | Get list of all users |

### 🏢 Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms` | Create a new room |
| `GET` | `/api/rooms` | Get all rooms |
| `GET` | `/api/rooms/:id` | Get room details |
| `PUT` | `/api/rooms/:id` | Update room settings |
| `DELETE` | `/api/rooms/:id` | Delete a room |

### 🔌 Room Connections
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms/:id/join` | Join a room |
| `POST` | `/api/rooms/:id/invite` | Invite user to room |
| `DELETE` | `/api/rooms/:id/leave` | Leave a room |

### 📄 Files & Folders
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms/:id/files` | Create a file or folder |
| `GET` | `/api/rooms/:id/files` | Get all files and folders |
| `GET` | `/api/rooms/:id/files/:fileId` | Get file content |
| `PUT` | `/api/rooms/:id/files/:fileId` | Update file content |
| `DELETE` | `/api/rooms/:id/files/:fileId` | Delete a file |

### 💬 Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms/:id/messages` | Send a chat message |
| `GET` | `/api/rooms/:id/messages` | Get chat history |

### 🤖 AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms/:id/ai/suggest` | Get code suggestions |
| `POST` | `/api/rooms/:id/ai/sentiment` | Get sentiment analysis |
| `POST` | `/api/rooms/:id/ai/keywords` | Get keywords from text |
| `POST` | `/api/rooms/:id/ai/diagnose` | Diagnose code errors |

### ⭐ Feature Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms/:id/features` | Create a feature request |
| `GET` | `/api/rooms/:id/features` | Get all feature requests |
| `PUT` | `/api/rooms/:id/features/:featureId/vote` | Vote on feature |
| `PUT` | `/api/rooms/:id/features/:featureId/status` | Update status |
| `PUT` | `/api/rooms/:id/features/:featureId` | Update feature request |
| `DELETE` | `/api/rooms/:id/features/:featureId` | Delete feature request |

## 🛠️ Setup & Installation
