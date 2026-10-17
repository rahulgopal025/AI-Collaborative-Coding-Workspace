# CodeCollabAI Postman Collection

This directory contains the automated Postman collection tailored directly from the `CodeCollabAI` backend source code. 

## 1. How to import the collection
1. Open Postman.
2. Click **Import** in the top left.
3. Select or drag-and-drop the file `CodeCollabAI.postman_collection.json` located in this directory.

## 2. Start Backend Command
Make sure the backend is running before firing requests:
```bash
cd backend
npm run dev
```

## 3. Base URL Configuration
The API requests all point to `{{baseUrl}}` dynamically. 
The collection is pre-configured with:
- `baseUrl` = `http://localhost:5000`

*Do NOT add `/api` to the `baseUrl`! It is already hardcoded into the request paths.*

## 4. How Authentication Variables Work
You **do not** need to manually copy JWT tokens!
- The `Register` endpoint automatically generates a unique `testEmail` using a pre-request script.
- Both `Register` and `Login` endpoints have test scripts that listen for `200/201` status codes.
- Upon success, the script automatically parses the JSON response and updates the `accessToken` and `userId` collection variables.
- Subsequent requests will automatically inject `Authorization: Bearer {{accessToken}}`.

## 5. How IDs are Captured Automatically
To facilitate a smooth testing flow, the collection captures Entity IDs from creation responses:
- `Create Project` saves `{{projectId}}`
- `Create Folder` saves `{{folderId}}`
- `Create File` saves `{{fileId}}`

## 6. Recommended Execution Order
The requests are designed in a logical sequence. Running the collection sequentially (or opening requests from top to bottom) works perfectly:
1. `Register` -> `Login` -> `Get Current User`
2. `Create Project`
3. `Add Member`
4. `Create Folder` -> `Create File`
5. `Ask AI` (requires a fileId)
6. `Get Chat History` / `List Activities`

## 7. What APIs are REST
Standard CRUD modules operate via REST JSON: Auth, Users, Projects, Members, Files, Folders, Activities, Chat History, and AI Assistance.

## 8. What functionality uses Socket.IO/Yjs
- **Live Cursors / Presence** (`presence:update`, `presence:join`)
- **CRDT Code Sync** (`editor:update`, `editor:sync` sending Yjs Buffers)
- **Live Chat** (`message:send`, `message:new`)

Because Postman cannot natively emulate binary Yjs synchronization easily over WebSockets, there is a `Realtime Collaboration Test (Documentation)` request under the `08 - Collaboration` folder explaining the events.

## 9. APIs Not Implemented
- The **Notifications** module acts as an internal service tracker. It is currently not exposed via a REST API route in the backend structure, thus there is no Postman request for it.

## 10. Known Testing Limitations
- Binary CRDT testing (Yjs) is best validated using the actual Frontend WebSockets rather than Postman due to the complexity of the encoded state vectors.
