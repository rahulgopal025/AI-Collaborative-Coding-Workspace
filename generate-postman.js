const fs = require('fs');
const path = require('path');

const collection = {
  info: {
    name: "CodeCollabAI Backend API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:5000", type: "string" },
    { key: "accessToken", value: "", type: "string" },
    { key: "testName", value: "Rahul Demo", type: "string" },
    { key: "testEmail", value: "rahul.demo@example.com", type: "string" },
    { key: "testPassword", value: "DemoPassword123!", type: "string" },
    { key: "userId", value: "", type: "string" },
    { key: "projectId", value: "", type: "string" },
    { key: "memberUserId", value: "", type: "string" },
    { key: "folderId", value: "", type: "string" },
    { key: "fileId", value: "", type: "string" }
  ],
  item: [
    {
      name: "01 - System",
      item: [
        {
          name: "Health Check",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{baseUrl}}/api/health", host: ["{{baseUrl}}"], path: ["api", "health"] },
            description: "Checks if the backend is running."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        }
      ]
    },
    {
      name: "02 - Auth",
      item: [
        {
          name: "Register",
          event: [
            {
              listen: "prerequest",
              script: {
                exec: [
                  "const timestamp = new Date().getTime();",
                  "pm.collectionVariables.set('testEmail', `rahul.demo.${timestamp}@example.com`);"
                ],
                type: "text/javascript"
              }
            },
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status code is 201', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "var jsonData = pm.response.json();",
                  "if(jsonData.data && jsonData.data.token) {",
                  "    pm.collectionVariables.set('accessToken', jsonData.data.token);",
                  "}",
                  "if(jsonData.data && jsonData.data.user && jsonData.data.user.id) {",
                  "    pm.collectionVariables.set('userId', jsonData.data.user.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"{{testName}}\",\n  \"email\": \"{{testEmail}}\",\n  \"password\": \"{{testPassword}}\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/auth/register", host: ["{{baseUrl}}"], path: ["api", "auth", "register"] },
            description: "Register a new user."
          }
        },
        {
          name: "Login",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "var jsonData = pm.response.json();",
                  "if(jsonData.data && jsonData.data.token) {",
                  "    pm.collectionVariables.set('accessToken', jsonData.data.token);",
                  "}",
                  "if(jsonData.data && jsonData.data.user && jsonData.data.user.id) {",
                  "    pm.collectionVariables.set('userId', jsonData.data.user.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: "{\n  \"email\": \"{{testEmail}}\",\n  \"password\": \"{{testPassword}}\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/auth/login", host: ["{{baseUrl}}"], path: ["api", "auth", "login"] },
            description: "Login with existing user credentials."
          }
        },
        {
          name: "Get Current User",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/auth/me", host: ["{{baseUrl}}"], path: ["api", "auth", "me"] },
            description: "Get authenticated user profile."
          }
        },
        {
          name: "Logout",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/auth/logout", host: ["{{baseUrl}}"], path: ["api", "auth", "logout"] },
            description: "Logout user."
          }
        }
      ]
    },
    {
      name: "03 - Users",
      item: [
        {
          name: "Get Me (User Module)",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/users/me", host: ["{{baseUrl}}"], path: ["api", "users", "me"] }
          }
        },
        {
          name: "Update Profile",
          request: {
            method: "PUT",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"{{testName}} Updated\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/users/me", host: ["{{baseUrl}}"], path: ["api", "users", "me"] }
          }
        },
        {
          name: "Get User By ID",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/users/{{userId}}", host: ["{{baseUrl}}"], path: ["api", "users", "{{userId}}"] }
          }
        }
      ]
    },
    {
      name: "04 - Projects",
      item: [
        {
          name: "Create Project",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test('Status code is 201', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "var jsonData = pm.response.json();",
                  "if(jsonData.data && jsonData.data.id) {",
                  "    pm.collectionVariables.set('projectId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"My New AI Project\",\n  \"description\": \"A collaborative workspace\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/projects", host: ["{{baseUrl}}"], path: ["api", "projects"] },
            description: "Creates a project. The creator becomes OWNER."
          }
        },
        {
          name: "List Projects",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/projects", host: ["{{baseUrl}}"], path: ["api", "projects"] }
          }
        },
        {
          name: "Get Project",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}"] }
          }
        },
        {
          name: "Update Project",
          request: {
            method: "PUT",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"Updated Project Name\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}"] }
          }
        },
        {
          name: "Delete Project",
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}"] },
            description: "Deletes a project. Placed at the end of workflows usually."
          }
        }
      ]
    },
    {
      name: "05 - Members",
      item: [
        {
          name: "List Members",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}/members", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}", "members"] }
          }
        },
        {
          name: "Add Member",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"email\": \"new.member@example.com\",\n  \"role\": \"DEVELOPER\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}/members", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}", "members"] }
          }
        },
        {
          name: "Change Member Role",
          request: {
            method: "PUT",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"role\": \"VIEWER\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}/members/{{memberUserId}}", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}", "members", "{{memberUserId}}"] }
          }
        },
        {
          name: "Remove Member",
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}/members/{{memberUserId}}", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}", "members", "{{memberUserId}}"] }
          }
        }
      ]
    },
    {
      name: "07 - Files and Folders",
      item: [
        {
          name: "Create Folder",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if(jsonData.data && jsonData.data.id) {",
                  "    pm.collectionVariables.set('folderId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"src\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}/folders", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}", "folders"] }
          }
        },
        {
          name: "Update Folder",
          request: {
            method: "PUT",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"lib\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/folders/{{folderId}}", host: ["{{baseUrl}}"], path: ["api", "folders", "{{folderId}}"] }
          }
        },
        {
          name: "Create File",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if(jsonData.data && jsonData.data.id) {",
                  "    pm.collectionVariables.set('fileId', jsonData.data.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"index.js\",\n  \"content\": \"console.log('Hello World');\",\n  \"language\": \"javascript\",\n  \"folderId\": \"{{folderId}}\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}/files", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}", "files"] }
          }
        },
        {
          name: "List Files and Folders",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/projects/{{projectId}}/files", host: ["{{baseUrl}}"], path: ["api", "projects", "{{projectId}}", "files"] }
          }
        },
        {
          name: "Get File",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/files/{{fileId}}", host: ["{{baseUrl}}"], path: ["api", "files", "{{fileId}}"] }
          }
        },
        {
          name: "Update File",
          request: {
            method: "PUT",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"main.js\",\n  \"content\": \"console.log('Updated File');\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/files/{{fileId}}", host: ["{{baseUrl}}"], path: ["api", "files", "{{fileId}}"] }
          }
        },
        {
          name: "Delete File",
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/files/{{fileId}}", host: ["{{baseUrl}}"], path: ["api", "files", "{{fileId}}"] }
          }
        },
        {
          name: "Delete Folder",
          request: {
            method: "DELETE",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { raw: "{{baseUrl}}/api/folders/{{folderId}}", host: ["{{baseUrl}}"], path: ["api", "folders", "{{folderId}}"] }
          }
        }
      ]
    },
    {
      name: "08 - Collaboration",
      item: [
        {
          name: "Realtime Collaboration Test (Documentation)",
          request: {
            method: "GET",
            header: [],
            url: { raw: "http://localhost:5000/socket.io", host: ["http://localhost:5000"], path: ["socket.io"] },
            description: "Socket.IO endpoints are used for realtime collaboration.\nEvents:\n- project:join { projectId }\n- project:leave { projectId }\n- file:join { fileId, projectId }\n- file:leave { fileId, projectId }\n- editor:update { fileId, update (Yjs binary) }\n- editor:sync { fileId }\n- presence:update { ...data }\n- message:send { projectId, content }\nRequires auth token to connect."
          }
        }
      ]
    },
    {
      name: "09 - Chat",
      item: [
        {
          name: "Get Chat History",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { 
              raw: "{{baseUrl}}/api/projects/{{projectId}}/messages?page=1&limit=20", 
              host: ["{{baseUrl}}"], 
              path: ["api", "projects", "{{projectId}}", "messages"],
              query: [
                { key: "page", value: "1" },
                { key: "limit", value: "20" }
              ]
            }
          }
        }
      ]
    },
    {
      name: "10 - Activities",
      item: [
        {
          name: "List Activities",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{accessToken}}" }],
            url: { 
              raw: "{{baseUrl}}/api/projects/{{projectId}}/activities?page=1&limit=20", 
              host: ["{{baseUrl}}"], 
              path: ["api", "projects", "{{projectId}}", "activities"],
              query: [
                { key: "page", value: "1" },
                { key: "limit", value: "20" }
              ]
            }
          }
        }
      ]
    },
    {
      name: "11 - AI",
      item: [
        {
          name: "Ask AI",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{accessToken}}" },
              { key: "Content-Type", value: "application/json" }
            ],
            body: {
              mode: "raw",
              raw: "{\n  \"projectId\": \"{{projectId}}\",\n  \"fileId\": \"{{fileId}}\",\n  \"selectedCode\": \"console.log('test');\",\n  \"language\": \"javascript\",\n  \"userPrompt\": \"Can you explain this code?\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/ai/ask", host: ["{{baseUrl}}"], path: ["api", "ai", "ask"] }
          }
        }
      ]
    },
    {
      name: "Negative Tests",
      item: [
        {
          name: "Register - Missing Email",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"Test User\",\n  \"password\": \"Password123!\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/auth/register", host: ["{{baseUrl}}"], path: ["api", "auth", "register"] }
          },
          event: [{ listen: "test", script: { exec: ["pm.test('Status code is 400', function () { pm.response.to.have.status(400); });"], type: "text/javascript" } }]
        },
        {
          name: "Create Project - Unauthorized",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: "{\n  \"name\": \"Test Project\"\n}"
            },
            url: { raw: "{{baseUrl}}/api/projects", host: ["{{baseUrl}}"], path: ["api", "projects"] }
          },
          event: [{ listen: "test", script: { exec: ["pm.test('Status code is 401', function () { pm.response.to.have.status(401); });"], type: "text/javascript" } }]
        }
      ]
    }
  ]
};

const dir = path.join(__dirname, 'postman');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'CodeCollabAI.postman_collection.json'), JSON.stringify(collection, null, 2));
console.log('Collection generated successfully.');
