# API Route Coverage Report

This report maps the actual backend route implementations to the generated Postman collection requests.

## Implemented Routes Matrix

| Backend Route | HTTP Method | Final URL | Postman Request Name | Auth Required | Module | Source File |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **System** | | | | | | |
| Health Check | GET | `/api/health` | `Health Check` | No | System | `src/routes/index.js` |
| **Auth** | | | | | | |
| Register | POST | `/api/auth/register` | `Register` | No | Auth | `src/modules/auth/auth.routes.js` |
| Login | POST | `/api/auth/login` | `Login` | No | Auth | `src/modules/auth/auth.routes.js` |
| Get Current User | GET | `/api/auth/me` | `Get Current User` | Yes | Auth | `src/modules/auth/auth.routes.js` |
| Logout | POST | `/api/auth/logout` | `Logout` | Yes | Auth | `src/modules/auth/auth.routes.js` |
| **Users** | | | | | | |
| Get Me | GET | `/api/users/me` | `Get Me (User Module)` | Yes | Users | `src/modules/users/user.routes.js` |
| Update Profile | PUT | `/api/users/me` | `Update Profile` | Yes | Users | `src/modules/users/user.routes.js` |
| Get User | GET | `/api/users/:id` | `Get User By ID` | Yes | Users | `src/modules/users/user.routes.js` |
| **Projects** | | | | | | |
| Create Project | POST | `/api/projects` | `Create Project` | Yes | Projects | `src/modules/projects/project.routes.js` |
| List Projects | GET | `/api/projects` | `List Projects` | Yes | Projects | `src/modules/projects/project.routes.js` |
| Get Project | GET | `/api/projects/:projectId` | `Get Project` | Yes | Projects | `src/modules/projects/project.routes.js` |
| Update Project | PUT | `/api/projects/:projectId` | `Update Project` | Yes | Projects | `src/modules/projects/project.routes.js` |
| Delete Project | DELETE | `/api/projects/:projectId` | `Delete Project` | Yes | Projects | `src/modules/projects/project.routes.js` |
| **Members** | | | | | | |
| List Members | GET | `/api/projects/:projectId/members` | `List Members` | Yes | Members | `src/modules/members/member.routes.js` |
| Add Member | POST | `/api/projects/:projectId/members` | `Add Member` | Yes | Members | `src/modules/members/member.routes.js` |
| Change Role | PUT | `/api/projects/:projectId/members/:userId`| `Change Member Role`| Yes | Members | `src/modules/members/member.routes.js` |
| Remove Member | DELETE| `/api/projects/:projectId/members/:userId`| `Remove Member` | Yes | Members | `src/modules/members/member.routes.js` |
| **Files & Folders** | | | | | | |
| Create Folder | POST | `/api/projects/:projectId/folders` | `Create Folder` | Yes | Files | `src/modules/files/file.routes.js` |
| Update Folder | PUT | `/api/folders/:folderId` | `Update Folder` | Yes | Files | `src/modules/files/file.routes.js` |
| Create File | POST | `/api/projects/:projectId/files` | `Create File` | Yes | Files | `src/modules/files/file.routes.js` |
| List Files/Folders| GET | `/api/projects/:projectId/files` | `List Files and Folders`| Yes | Files | `src/modules/files/file.routes.js` |
| Get File | GET | `/api/files/:fileId` | `Get File` | Yes | Files | `src/modules/files/file.routes.js` |
| Update File | PUT | `/api/files/:fileId` | `Update File` | Yes | Files | `src/modules/files/file.routes.js` |
| Delete File | DELETE | `/api/files/:fileId` | `Delete File` | Yes | Files | `src/modules/files/file.routes.js` |
| Delete Folder | DELETE | `/api/folders/:folderId` | `Delete Folder` | Yes | Files | `src/modules/files/file.routes.js` |
| **Collaboration** | | | | | | |
| Socket.IO Gateway | WS | `/socket.io` | `Realtime Collaboration`| Yes | Collab | `src/modules/collaboration/...` |
| **Chat** | | | | | | |
| Get Chat History| GET | `/api/projects/:projectId/messages` | `Get Chat History`| Yes | Chat | `src/modules/chat/chat.routes.js` |
| **Activities** | | | | | | |
| List Activities | GET | `/api/projects/:projectId/activities`| `List Activities` | Yes | Activities| `src/modules/activities/activity.routes.js` |
| **AI** | | | | | | |
| Ask AI | POST | `/api/ai/ask` | `Ask AI` | Yes | AI | `src/modules/ai/ai.routes.js` |

## Mismatch Detection

- **Backend Route Exists → Postman Request Exists**: `Verified.`
- **Missing Implementations**:
  - `Notifications` module exists in the backend for internal tracking but exposes no REST API routes currently.
- **Unrepresentable APIs**:
  - Real-time `Socket.IO` operations (Yjs CRDT buffers, Presence, Chat Sending) cannot be natively run as standard JSON HTTP requests. I created a documented Postman request pointing to `http://localhost:5000/socket.io` to explain how it behaves.
- **Fixed Issues**:
  - During inspection, I noticed that `members`, `chat` (messages), and `activities` were technically missing from the main route attachments (unregistered). I fixed `project.routes.js` to correctly mount them to `/api/projects/:projectId/*` so they can be properly tested by this collection!
