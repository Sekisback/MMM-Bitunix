Module.register("MMM-Bitunix", {
  defaults: {
    stocks: [],
    display_duration: 3, // Sekunden sichtbar
    showChangePercent: true,
    updateInterval: 30000
  },

  getStyles() {
    return ["MMM-Bitunix.css"];
  },

  getTemplate() {
    return "templates/MMM-Bitunix.njk";
  },

  start() {
    this.state = { stocks: [], lastUpdate: null };
    this.currentIndex = 0;
    this.currentStock = null;
    this.rotationInterval = null;

    // Symbols automatisch auf *USDT* erweitern
    this.config.stocks = this.config.stocks.map(s => {
      return {
        symbol: s.symbol.endsWith("USDT") ? s.symbol : `${s.symbol}USDT`
      };
    });

    console.log("[MMM-Bitunix] Normalisierte Stocks:", this.config.stocks);
    
    if (!this.config.stocks || this.config.stocks.length === 0) {
      console.warn("[MMM-Bitunix] No stocks defined in config.js");
      return;
    }

    this.sendSocketNotification("BITUNIX_REQUEST_TICKERS", {
      stocks: this.config.stocks
    });
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "BITUNIX_TICKERS_RESPONSE") {
      if (!payload || !Array.isArray(payload.stocks) || payload.stocks.length === 0) {
        console.warn("[MMM-Bitunix] Leere Antwort vom Helper.");
        return;
      }

      // State aktualisieren
      this.state.stocks = payload.stocks.filter(s => s && s.symbol);
      this.state.lastUpdate = payload.lastUpdate;

      // Index zurücksetzen, falls größer als Länge
      if (this.currentIndex >= this.state.stocks.length) {
        this.currentIndex = 0;
      }

      // Wenn kein aktueller Stock gesetzt -> ersten wählen
      if (!this.currentStock) {
        this.currentStock = this.state.stocks[0];
        this.updateDom(0);
        this.startRotation();
      }
    }
  },

  startRotation() {
    if (!this.state.stocks || this.state.stocks.length === 0) {
      console.warn("[MMM-Bitunix] Keine Stocks zum Rotieren.");
      return;
    }

    const visibleTime = this.config.display_duration * 1000;
    const fadeTime = 2000; // 2 Sekunden, stabil auf dem Pi

    clearInterval(this.rotationInterval);

    this.rotationInterval = setInterval(() => {
      // Sicherstellen, dass Liste existiert
      if (!this.state.stocks || this.state.stocks.length === 0) return;

      this.currentIndex = (this.currentIndex + 1) % this.state.stocks.length;
      this.currentStock = this.state.stocks[this.currentIndex];

      if (this.currentStock) {
        this.updateDom(fadeTime);
      } else {
        console.warn("[MMM-Bitunix] currentStock undefined bei Index", this.currentIndex);
      }

      // Nach jedem vollen Durchlauf neu abrufen
      if (this.currentIndex === 0) {
        this.sendSocketNotification("BITUNIX_REQUEST_TICKERS", {
          stocks: this.config.stocks
        });
      }
    }, visibleTime + fadeTime);
  },



  getDecimals(price) {
    if (price < 1) return 6;
    if (price < 10) return 4;
    if (price < 100) return 3;
    return 2;
  },

  updatePriceInDOM() {
    const priceSpan = document.querySelector(".MMM-Bitunix .price");
    const changeSpan = document.querySelector(".MMM-Bitunix .change");
    const itemDiv = document.querySelector(".MMM-Bitunix .bitunix-item");

    if (priceSpan && this.currentStock) {
      const decimals = this.getDecimals(this.currentStock.lastPrice);
      priceSpan.textContent = this.currentStock.lastPrice.toFixed(decimals);
    }

    if (changeSpan && this.currentStock) {
      changeSpan.textContent = `(${this.currentStock.changePercent.toFixed(2)}%)`;
    }

    if (itemDiv) {
      itemDiv.classList.remove("positive", "negative", "neutral");
      const colorClass =
        this.currentStock.changePercent > 0
          ? "positive"
          : this.currentStock.changePercent < 0
          ? "negative"
          : "neutral";
      itemDiv.classList.add(colorClass);
    }
  },

  getTemplateData() {
    if (!this.currentStock) return { config: this.config, stock: null };

    const decimals = this.getDecimals(this.currentStock.lastPrice);
    return {
      config: this.config,
      stock: {
        ...this.currentStock,
        decimals,
        cleanSymbol: this.currentStock.symbol.replace("USDT", "")
      },
      lastUpdate: this.state.lastUpdate
        ? moment(this.state.lastUpdate).format("HH:mm:ss")
        : null
    };
  }
});
