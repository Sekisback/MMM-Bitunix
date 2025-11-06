const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * OpenAPI WebSocket Futures Public API Client
 */
class OpenApiWsFuturePublic extends EventEmitter {
    /**
     * Initialize WebSocket public API client
     * @param {Object} config  Configuration object
     */
    constructor(config) {
        super();
        this.config = config;
        this.baseUrl = config.websocket.public_uri;
        this.reconnectInterval = config.websocket.reconnect_interval * 1000;
        this.heartbeatInterval = 3000; // 3 seconds

        this.ws = null;
        this.isConnected = false;
        this.stopPing = false;
        this.pingTimer = null;
        this.reconnectTimer = null;
    }

    /**
     * Send ping message to server
     * @private
     */
    sendPing() {
        if (!this.stopPing && this.isConnected && this.ws) {
            try {
                const pingData = { op: 'ping', ping: Date.now() };
                console.log("send ping:", JSON.stringify(pingData));
                this.ws.send(JSON.stringify(pingData));
            } catch (error) {
                console.error("ping send failed:", error.message);
                this.isConnected = false;
            }
        }
    }

    /**
     * Handle received raw messages
     * @param {string} message
     * @private
     */
    handleMessage(message) {
        try {
            const data = JSON.parse(message);

            if (data.op) {
                switch (data.op) {
                    case 'pong':
                        console.log("received pong");
                        return;
                    case 'connect':
                        console.log("connection acknowledged");
                        return;
                }
            }

            const allowedChannels = ['depth_book1', 'trade', 'ticker'];
            if (data.ch && allowedChannels.includes(data.ch)) {
                this.processMessage(data);
            } else {
                console.log("unknown message:", message);
            }
        } catch (error) {
            console.error("message parse error:", error.message);
        }
    }

    /**
     * Process valid business messages
     * @param {Object} message
     * @private
     */
    processMessage(message) {
        try {
            switch (message.ch) {
                case 'trade':
                    this.emit('trade', message.data);
                    break;
                case 'ticker':
                    this.emit('ticker', message.data);
                    break;
                case 'depth_book1':
                    this.emit('depth', message.data);
                    break;
            }
        } catch (error) {
            console.error("business message handling error:", error.message);
        }
    }

    /**
     * Subscribe to public channels
     * @param {Array} channels
     */
    subscribe(channels) {
        if (!this.isConnected || !this.ws) {
            throw new Error("WebSocket is not connected");
        }

        const msg = JSON.stringify({ op: 'subscribe', args: channels });
        this.ws.send(msg);
        console.log("subscription sent");
    }

    /**
     * Internal WebSocket connect method
     * @private
     */
    connect() {
        try {
            this.ws = new WebSocket(this.baseUrl, {
                headers: { 'User-Agent': 'Node.js WebSocket Client' }
            });

            this.ws.on('open', () => {
                this.isConnected = true;
                console.log("WebSocket connected (public)");
                this.startHeartbeat();
                this.emit('connected');
            });

            this.ws.on('message', (data) => this.handleMessage(data.toString()));

            this.ws.on('close', (code, reason) => {
                console.log(`WebSocket closed: ${code} ${reason}`);
                this.cleanup();
                this.scheduleReconnect();
                this.emit('disconnected', code, reason);
            });

            this.ws.on('error', (error) => {
                console.error("WebSocket error:", error.message);
                this.cleanup();
                this.emit('error', error);
            });

        } catch (error) {
            console.error("connection failed:", error.message);
            this.cleanup();
            this.scheduleReconnect();
        }
    }

    /**
     * Start heartbeat ping loop
     * @private
     */
    startHeartbeat() {
        this.stopPing = false;
        this.pingTimer = setInterval(() => this.sendPing(), this.heartbeatInterval);
    }

    /**
     * Schedule reconnect after disconnect
     * @private
     */
    scheduleReconnect() {
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectInterval);
    }

    /**
     * Cleanup WS state and timers
     * @private
     */
    cleanup() {
        this.isConnected = false;
        this.ws = null;

        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    /**
     * Start WebSocket client
     */
    start() {
        this.connect();
    }

    /**
     * Stop WebSocket client
     */
    stop() {
        this.stopPing = true;
        this.cleanup();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = OpenApiWsFuturePublic;
