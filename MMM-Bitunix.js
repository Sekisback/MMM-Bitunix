Module.register("MMM-Bitunix", {
  defaults: {
    stocks: [],
    showChangePercent: true,
    scrollSpeed: 0
  },

  getStyles() {
    return ["MMM-Bitunix.css"];
  },

  getTemplate() {
    return "templates/MMM-Bitunix.njk";
  },

  start() {
    this.state = { stocks: [], lastUpdate: null };
    this.initialRender = true;

    // Warn if no symbols configured
    if (!this.config.stocks || this.config.stocks.length === 0) {
      Log.warn("[MMM-Bitunix] No stocks defined in config.js");
      return;
    }

    // Request initial data from node helper
    this.sendSocketNotification(`BITUNIX_TICKER_REQUEST-${this.identifier}`, {
      stocks: this.config.stocks
    });
  },



  socketNotificationReceived(notification, payload) {
    const expected = `BITUNIX_TICKER_RESPONSE-${this.identifier}`;
    
    if (notification === expected) {
      this.state = payload;
      
      if (this.initialRender) {
        this.updateDom();
        this.initialRender = false;
        // Setup scroll nach erstem Render
        setTimeout(() => this.setupScroll(), 500);
      } else {
        this.updateValues();
      }
    }
  },

  updateValues() {
    if (!this.state.stocks || this.state.stocks.length === 0) return;

    // Get all price items (skip markers)
    const allItems = document.querySelectorAll(".bitunix-item:not(.loop-marker)");
    if (!allItems.length) return;

    // Update each stock item
    this.state.stocks.forEach(stock => {
      const symbol = stock.symbol ? stock.symbol.toUpperCase() : null;
      const selector = `[data-symbol="${symbol}"]`;
      const items = document.querySelectorAll(selector);

      items.forEach(item => {
        // Update price value
        const priceSpan = item.querySelector(".price");
        if (priceSpan) {
          let decimals = 2;
          if (stock.lastPrice < 1) decimals = 6;
          else if (stock.lastPrice < 10) decimals = 4;
          else if (stock.lastPrice < 100) decimals = 3;
          
          // Nur den Preis-Wert updaten, nicht die Unit
          const unitSpan = priceSpan.querySelector(".unit");
          priceSpan.textContent = stock.lastPrice.toFixed(decimals);
          if (unitSpan) priceSpan.appendChild(unitSpan);
        }

        // Update change percentage
        const changeSpan = item.querySelector(".change");
        if (changeSpan) {
          changeSpan.textContent = (stock.changePercent?.toFixed(2) ?? "--") + "%";
        }

        // Update color class based on change
        item.classList.remove("positive", "negative", "neutral");
        item.classList.add(
          stock.changePercent > 0 ? "positive" :
          stock.changePercent < 0 ? "negative" : "neutral"
        );
      });
    });
  },

  setupScroll() {
    const frame = document.querySelector(".bitunix-tickerframe");
    if (!frame) return;

    // Nur einmal das HTML duplizieren
    if (!frame.dataset.scrollInit) {
      frame.innerHTML += frame.innerHTML;
      frame.dataset.scrollInit = "true";
    }

    // CSS-Animation nur wenn scrollSpeed > 0
    if (this.config.scrollSpeed > 0) {
      // scrollSpeed in px/s → Duration in Sekunden berechnen
      const frameWidth = frame.scrollWidth / 2;
      const duration = frameWidth / this.config.scrollSpeed;
      
      // Animation mit berechneter Duration starten
      frame.style.animation = `bitunix-scroll-anim linear infinite ${duration}s`;
    }
  },

  getTemplateData() {
    return {
      config: this.config,
      stocks: this.state.stocks || [],
      lastUpdate: this.state.lastUpdate
        ? moment(this.state.lastUpdate).format("HH:mm:ss")
        : null
    };
  }
});