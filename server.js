import http from "http";

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.PROJECT_ID;


const server = http.createServer(async (req, res) => {
//   console.log(req);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // rest of your logic…
    if (req.method === "POST" && req.url === "/login") {
            let body = "";
            req.on("data", chunk => body += chunk);
    
        req.on("end", async () => {
            const { email, password } = JSON.parse(body);
    
            const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            })
            }
        );
    
            const data = await response.json();
            // console.log(data)
    
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data));
        });
    } 
    // else {
    //     res.writeHead(404);
    //     res.end();
    //     // return
    // }

    if (req.method === "POST" && req.url === "/signup") {
        let body = "";

        req.on("data", chunk => body += chunk);

        req.on("end", async () => {
            const { email, password } = JSON.parse(body);

            // 1️⃣ Create Auth user
            const authRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
                })
            }
            );

            const authData = await authRes.json();

            if (authData.error) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify(authData));
                return;
            }

            const uid = authData.localId;
            const idToken = authData.idToken;

            // 2️⃣ Create Firestore user document
            const fsRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
            {
                method: "PATCH",
                headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({
                fields: {
                    email: { stringValue: email },
                    name: { stringValue: "" },
                    createdAt: { timestampValue: new Date().toISOString() }
                }
                })
            }
            );

            if (!fsRes.ok) {
            const err = await fsRes.text();
            console.error("Firestore error:", err);
            }

            // 3️⃣ Return auth info
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(authData));
            return;
        });
    }
    
    if (req.method === "POST" && req.url === "/refresh-token") {
        let body = "";

        req.on("data", chunk => body += chunk);

        req.on("end", async () => {
            const { refreshToken } = JSON.parse(body);

            if (!refreshToken) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing refresh token" }));
            return;
            }

            try {
            const response = await fetch(
                `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
                {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: `grant_type=refresh_token&refresh_token=${refreshToken}`
                }
            );

            const data = await response.json();


            if (data.error) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify(data));
                return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                idToken: data.id_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in,
                uid: data.user_id
            }));
            return;

            } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Refresh failed" }));
            return;
            }
        });
    }
    if (req.method === "GET" && req.url === "/users") {
        // console.log(req.headers.authorization.split(" ")[1])
        const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`,
        {
        headers: {
            "Authorization": `Bearer ${req.headers.authorization.split(" ")[1]}`
        }
        }
    );

    const data = await response.json();
    // console.log(data);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return
    }

    // if (req.method === "POST" && req.url === "/chats") {
    //     let body = "";

    //     req.on("data", chunk => body += chunk);

    //     req.on("end", async () => {
    //         const { otherUserId } = JSON.parse(body);

    //         const authHeader = req.headers.authorization;
    //         if (!authHeader) {
    //             res.writeHead(401);
    //             res.end("Unauthorized");
    //             return;
    //         }

    //         const idToken = authHeader.split(" ")[1];
    //         // console.log(idToken)

    //         // 🔐 Get current user UID from token
    //         const tokenInfoRes = await fetch(
    //         `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    //         {
    //             method: "POST",
    //             headers: {
    //                 "Content-Type": "application/json",
    //                 // Authorization: `Bearer ${idToken}`
    //             },
    //             body: JSON.stringify({ idToken })
    //         }
    //         );

    //         const tokenInfo = await tokenInfoRes.json();
    //         // e.log(tokenInfo)
    //         const currentUserId = tokenInfo.users[0].localId;

    //         // ✅ Deterministic chatId
    //         const chatId =
    //         currentUserId < otherUserId
    //             ? `${currentUserId}_${otherUserId}`
    //             : `${otherUserId}_${currentUserId}`;

    //         // ✅ Create chat (PATCH = create if not exists)
    //         await fetch(
    //             `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats/${chatId}`,
    //             {
    //                 method: "PATCH",
    //                 headers: {
    //                     "Content-Type": "application/json",
    //                     Authorization: `Bearer ${idToken}`
    //                 },
    //                 body: JSON.stringify({
    //                 fields: {
    //                     participants: {
    //                     arrayValue: {
    //                         values: [
    //                         { stringValue: currentUserId },
    //                         { stringValue: otherUserId }
    //                         ]
    //                     }
    //                     },
    //                     createdAt: { timestampValue: new Date().toISOString() }
    //                 }
    //                 })
    //             }
    //         );

    //         // after chat is created
    //         const now = new Date().toISOString();

    //         await fetch(
    //         `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/userChats/${uidA}/chats/${chatId}`,
    //         {
    //             method: "PATCH",
    //             headers: {
    //             "Content-Type": "application/json",
    //             Authorization: `Bearer ${idToken}`
    //             },
    //             body: JSON.stringify({
    //             fields: {
    //                 chatId: { stringValue: chatId },
    //                 withUserId: { stringValue: uidB },
    //                 lastMessage: { stringValue: "" },
    //                 lastMessageAt: { timestampValue: now }
    //             }
    //             })
    //         }
    //         );

    //         await fetch(
    //         `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/userChats/${uidB}/chats/${chatId}`,
    //         {
    //             method: "PATCH",
    //             headers: {
    //             "Content-Type": "application/json",
    //             Authorization: `Bearer ${idToken}`
    //             },
    //             body: JSON.stringify({
    //             fields: {
    //                 chatId: { stringValue: chatId },
    //                 withUserId: { stringValue: uidA },
    //                 lastMessage: { stringValue: "" },
    //                 lastMessageAt: { timestampValue: now }
    //             }
    //             })
    //         }
    //         );

    //         res.writeHead(200, { "Content-Type": "application/json" });
    //         res.end(JSON.stringify({ chatId }));
    //         return;
    //     });
    // }

    if (req.method === "POST" && req.url === "/chats") {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", async () => {
            try {
            const parsedBody = JSON.parse(body);
            const currentUserId = parsedBody.currentUserId;
            const otherUserId = parsedBody.otherUserId;

            const authHeader = req.headers.authorization;

            if (!authHeader || !currentUserId || !otherUserId) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request data" }));
                return;
            }

            const idToken = authHeader.split(" ")[1];

            // ✅ Deterministic chatId
            const chatId =
                currentUserId < otherUserId
                ? `${currentUserId}_${otherUserId}`
                : `${otherUserId}_${currentUserId}`;

            const now = new Date().toISOString();

            // ✅ 1. Create / update chat document
            await fetch(
                `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats/${chatId}`,
                {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    fields: {
                    participants: {
                        arrayValue: {
                        values: [
                            { stringValue: currentUserId },
                            { stringValue: otherUserId }
                        ]
                        }
                    },
                    createdAt: { timestampValue: now }
                    }
                })
                }
            );

            // ✅ 2. userChats for current user
            await fetch(
                `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/userChats/${currentUserId}/chats/${chatId}`,
                {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    fields: {
                    chatId: { stringValue: chatId },
                    withUserId: { stringValue: otherUserId },
                    lastMessage: { stringValue: "" },
                    lastMessageAt: { timestampValue: now }
                    }
                })
                }
            );

            // ✅ 3. userChats for other user
            await fetch(
                `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/userChats/${otherUserId}/chats/${chatId}`,
                {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    fields: {
                    chatId: { stringValue: chatId },
                    withUserId: { stringValue: currentUserId },
                    lastMessage: { stringValue: "" },
                    lastMessageAt: { timestampValue: now }
                    }
                })
                }
            );

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ chatId }));
            return;

            } catch (error) {
            console.error("Create chat error:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to create chat" }));
            return;
            }
        });
    }



    if (req.method === 'POST' & req.url.startsWith("/chats/") && req.url.endsWith("/messages")) {
        let body = "";

        req.on("data", chunk => (body += chunk));

        req.on("end", async () => {
            const { senderId, text } = JSON.parse(body);
            const authHeader = req.headers.authorization;
            // console.log(senderId)
            // console.log(authHeader)
            // console.log(text)
            if (!authHeader || !senderId || !text) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: "Invalid request" }));
                return;
            }

            const idToken = authHeader.split(" ")[1];
            const chatId = req.url.split("/")[2];
            // console.log(chatId)

            // ✅ 1. Fetch chat document
            const chatRes = await fetch(
                `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats/${chatId}`,
                {
                    headers: {
                        Authorization: `Bearer ${idToken}`
                    }
                }
                );

            const chatData = await chatRes.json();
            console.log(chatData);
            if (!chatData.fields) {
                res.writeHead(403);
                res.end(JSON.stringify({ error: "Chat not found or forbidden" }));
                return;
            }

            const participants =
            chatData.fields.participants.arrayValue.values.map(v => v.stringValue);

            // ✅ 2. Ensure sender is part of this chat
            if (!participants.includes(senderId)) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: "Not a chat participant" }));
            return;
            }

            const receiverId = participants.find(id => id !== senderId);

            // ✅ 3. Create message
            await fetch(
            `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats/${chatId}/messages`,
            {
                method: "POST",
                headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({
                fields: {
                    senderId: { stringValue: senderId },
                    receiverId: { stringValue: receiverId },
                    text: { stringValue: text },
                    sentAt: { timestampValue: new Date().toISOString() },
                    read: { booleanValue: false }
                }
                })
            }
            );

            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
        });
    }

    if (req.method === "GET" && req.url === "/chats") {
        console.log(123)
        try {
            const authHeader = req.headers.authorization;
            const uid = req.headers["x-user-id"];

            if (!authHeader || !uid) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
            }

            const idToken = authHeader.split(" ")[1];

            const firestoreRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/userChats/${uid}/chats`,
            {
                method: "GET",
                headers: {
                Authorization: `Bearer ${idToken}`
                }
            }
            );

            const firestoreData = await firestoreRes.json();

            if (firestoreData.error) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify(firestoreData));
            return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(firestoreData.documents || []));
            return;

        } catch (error) {
            console.error("Fetch chats error:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to fetch chats" }));
            return;
        }
    }

    if (req.method === "GET" && req.url.startsWith("/chats/") && req.url.endsWith("/messages")) {
        console.log(123)
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
            }

            const idToken = authHeader.split(" ")[1];

            // ✅ Extract chatId from URL
            // /chats/{chatId}/messages
            const parts = req.url.split("/");
            const chatId = parts[2];

            if (!chatId) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Missing chatId" }));
                return;
            }

            const firestoreRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats/${chatId}/messages?orderBy=sentAt`,
            {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            }
            );

            const firestoreData = await firestoreRes.json();

            if (firestoreData.error) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify(firestoreData));
                return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(firestoreData.documents || []));
            return;

        } catch (error) {
            console.error("Fetch messages error:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to fetch messages" }));
            return;
        }
    }


//     if (req.method === "POST" && req.url.startsWith("/chats/") && req.url.endsWith("/messages")) {
//         let body = "";

//         req.on("data", chunk => body += chunk);

//         req.on("end", async () => {
//             const { text } = JSON.parse(body);

//             const authHeader = req.headers.authorization;
//             if (!authHeader) {
//             res.writeHead(401);
//             res.end("Unauthorized");
//             return;
//             }

//         const idToken = authHeader.split(" ")[1];

//         // 1️⃣ Extract chatId from URL
//         const chatId = req.url.split("/")[2];

//         // 2️⃣ Get current user UID
//         const tokenInfoRes = await fetch(
//         `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
//         {
//             method: "POST",
//             headers: {
//             "Content-Type": "application/json",
//             // Authorization: `Bearer ${idToken}`
//             },
//             body: JSON.stringify({ idToken })
//         }
//         );

//         const tokenInfo = await tokenInfoRes.json();
//         const senderId = tokenInfo.users[0].localId;

//         if (!tokenInfo || !Array.isArray(tokenInfo.users)) {
//             res.writeHead(401, { "Content-Type": "application/json" });
//             res.end(JSON.stringify({
//                 error: "Invalid or expired ID token"
//             }));
//             return;
//         }


//     // 3️⃣ Get chat to determine receiver
//     const chatRes = await fetch(
//       `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats/${chatId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${idToken}`
//         }
//       }
//     );

//     const chatData = await chatRes.json();
//     console.log(chatData)
//     const participants = chatData.fields.participants.arrayValue.values.map(v => v.stringValue);

//     const receiverId = participants.find(uid => uid !== senderId);

//     // 4️⃣ Create message
//     await fetch(
//       `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats/${chatId}/messages`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${idToken}`
//         },
//         body: JSON.stringify({
//           fields: {
//             senderId: { stringValue: senderId },
//             receiverId: { stringValue: receiverId },
//             text: { stringValue: text },
//             sentAt: { timestampValue: new Date().toISOString() },
//             read: { booleanValue: false }
//           }
//         })
//       }
//     );

//     // 5️⃣ Update chat metadata
//     await fetch(
//       `https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/chats/${chatId}`,
//       {
//         method: "PATCH",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${idToken}`
//         },
//         body: JSON.stringify({
//           fields: {
//             lastMessage: { stringValue: text },
//             lastMessageAt: { timestampValue: new Date().toISOString() }
//           }
//         })
//       }
//     );

//     res.writeHead(200, { "Content-Type": "application/json" });
//     res.end(JSON.stringify({ success: true }));
//     return;
//   });
//     }

});

// });

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// server.listen(3000);