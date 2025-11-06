# MMM-Bitunix

A MagicMirror² module that displays live cryptocurrency ticker data from the Bitunix Futures public WebSocket API.  
The module shows symbols, prices, and 24h percentage change. It includes a smooth scrolling ticker animation that automatically updates in real time.

## Features

- Live ticker updates via Bitunix WebSocket API  
- Displays symbol, last price, and percent change  
- Color indicators:
  - Green for positive change
  - Red for negative change
  - Gray for neutral/no movement
- Smooth infinite scrolling price ticker
- Configurable scroll speed
- Minimal resource usage

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/YOUR-REPO/MMM-Bitunix
cd MMM-Bitunix
npm install
```

## Configuration

Add to your `config.js`:

```js
{
  module: "MMM-Bitunix",
  position: "top_bar",
  config: {
    stocks: [
      { symbol: "BTCUSDT" },
      { symbol: "ETHUSDT" },
      { symbol: "SOLUSDT" }
    ],
    showChangePercent: true,
    scrollSpeed: 40 // pixels per second
  }
}
```

## Config Options

| Option | Type | Default | Description |
|-------|------|---------|-------------|
| `stocks` | array | `[]` | List of symbol objects (uppercase symbols recommended) |
| `showChangePercent` | boolean | `true` | Display 24h percent change |
| `scrollSpeed` | number | `0` | Pixel-based ticker speed. `0` disables scrolling. |

Example:

```js
stocks: [
  { symbol: "BTCUSDT" },
  { symbol: "AVAXUSDT" }
]
```

## Data Source

This module uses the Bitunix Futures **public WebSocket API**:

```
wss://fapi.bitunix.com/public/
```

Ticker channel:  
`ch: "tickers"` → receives 24h ticker update messages

No API key required.

## File Structure

```
MMM-Bitunix/
│
├─ MMM-Bitunix.js          # Frontend DOM and ticker updates
├─ node_helper.js          # WebSocket client + data formatting
├─ MMM-Bitunix.css         # Styling + color states + scroll layout
└─ templates/
   └─ MMM-Bitunix.njk      # Display template
```

## Notes

- The ticker scroll animation duplicates the ticker content to achieve a seamless infinite loop.
- If no symbols are configured, the module will not start the WebSocket connection.
- The module reconnects automatically if the WebSocket closes.

## License

MIT License — free to use and modify.

## Credits

Developed by **Sascha (Korni)** with help from ChatGPT (GPT-5).  
Data provided by **Bitunix** public market WebSocket.
