"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// server/signaling.ts
const http_1 = require("http");
const ws_1 = __importStar(require("ws"));
const uuid_1 = require("uuid");
const rooms = {};
// Create an HTTP server
const server = (0, http_1.createServer)((req, res) => {
    console.log(`HTTP request received: ${req.method} ${req.url}`);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server running\n');
});
// Attach WebSocket server to the HTTP server
// This automatically handles the 'upgrade' event
const wss = new ws_1.WebSocketServer({ server });
wss.on('connection', (ws, req) => {
    const clientId = (0, uuid_1.v4)();
    console.log(`Client ${clientId} connected via WebSocket from ${req.url}`);
    ws.on('message', (message) => {
        console.log(`Received message from client ${clientId}: ${message}`);
        try {
            const data = JSON.parse(message);
            switch (data.type) {
                case 'join':
                    const { roomId, peerId } = data;
                    if (!roomId || !peerId) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing roomId or peerId' }));
                        return;
                    }
                    if (!rooms[roomId]) {
                        rooms[roomId] = new Map();
                    }
                    rooms[roomId].set(peerId, ws);
                    // Notify all other peers in the room
                    rooms[roomId].forEach((client, existingPeerId) => {
                        if (client !== ws && client.readyState === ws_1.default.OPEN) {
                            client.send(JSON.stringify({
                                type: 'peerId',
                                peerId: peerId,
                                roomId,
                            }));
                        }
                        if (existingPeerId !== peerId && ws.readyState === ws_1.default.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'peerId',
                                peerId: existingPeerId,
                                roomId,
                            }));
                        }
                    });
                    break;
                case 'offer':
                case 'answer':
                case 'ice-candidate':
                    const { roomId: targetRoomId, targetPeerId } = data;
                    if (!targetRoomId || !targetPeerId) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing roomId or targetPeerId' }));
                        return;
                    }
                    const room = rooms[targetRoomId];
                    if (room) {
                        const targetClient = room.get(targetPeerId);
                        if (targetClient && targetClient.readyState === ws_1.default.OPEN) {
                            targetClient.send(JSON.stringify(data));
                        }
                        else {
                            console.log(`Target peer ${targetPeerId} not found in room ${targetRoomId}`);
                        }
                    }
                    else {
                        console.log(`Room ${targetRoomId} not found`);
                    }
                    break;
                default:
                    ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        }
        catch (error) {
            console.error(`Error processing message from client ${clientId}:`, error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });
    ws.on('close', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            room.forEach((client, peerId) => {
                if (client === ws) {
                    room.delete(peerId);
                }
            });
            if (room.size === 0) {
                delete rooms[roomId];
            }
        }
        console.log(`Client ${clientId} disconnected`);
    });
    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
    });
});
wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});
// Start the HTTP server on port 8080
server.listen(8080, () => {
    console.log('Signaling server running on ws://localhost:8080');
});
