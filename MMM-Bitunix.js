// Module-Registrierung mit Config
Module.register("MMM-Bitunix", {
  // Standard-Konfiguration
  defaults: {
    stocks: [],
    fadingSpeed: 3,
    fadingTime: 2.5,
    showChangePercent: true,
    updateInterval: 30000
  },

  // CSS-Datei laden
  getStyles() {
    return ["MMM-Bitunix.css"];
  },

  // Template laden
  getTemplate() {
    return "templates/MMM-Bitunix.njk";
  },

  // Modul starten
  start() {
    this.state = { stocks: [], lastUpdate: null };
    this.currentIndex = 0;
    this.currentStock = null;
    this.rotationInterval = null;

    console.log("[MMM-Bitunix] Config:", this.config);

    if (!this.config.stocks || this.config.stocks.length === 0) {
      console.warn("[MMM-Bitunix] No stocks defined in config.js");
      return;
    }

    console.log("[MMM-Bitunix] Stocks:", this.config.stocks.map(s => s.symbol));

    // Erste Daten vom Node Helper anfordern
    this.sendSocketNotification("BITUNIX_REQUEST_TICKERS", {
      stocks: this.config.stocks
    });
  },

  // Socket-Benachrichtigungen empfangen
  socketNotificationReceived(notification, payload) {
    if (notification === "BITUNIX_TICKERS_RESPONSE") {
      console.log("[MMM-Bitunix] Tickers erhalten:", payload);

      // Wenn noch keine Rotation läuft: Start
      if (!this.rotationInterval) {
        this.state.stocks = payload.stocks;
        this.state.lastUpdate = payload.lastUpdate;

        if (this.state.stocks.length > 0) {
          this.currentStock = this.state.stocks[0];
          console.log("[MMM-Bitunix] Starte mit:", this.currentStock.symbol);
        }

        this.startRotation();
      } else {
        // Rotation läuft: Preise updaten
        payload.stocks.forEach(newStock => {
          const existing = this.state.stocks.find(s => s.symbol === newStock.symbol);
          if (existing) {
            existing.lastPrice = newStock.lastPrice;
            existing.changePercent = newStock.changePercent;
          }
        });

        this.state.lastUpdate = payload.lastUpdate;

        const affected = payload.stocks.find(s => s.symbol === this.currentStock.symbol);
        if (affected) this.updatePriceInDOM();
      }
    }
  },

  // Rotation starten
  startRotation() {
    if (!this.state.stocks || this.state.stocks.length === 0) {
      console.warn("[MMM-Bitunix] Keine Stocks vorhanden");
      return;
    }

    this.currentIndex = 0;
    this.currentStock = this.state.stocks[this.currentIndex];
    console.log("[MMM-Bitunix] Rotation gestartet mit:", this.currentStock.symbol);

    this.updateDom(0);

    // Einheitliche Dauer: Fading + Anzeigezeit
    const fadeDuration = (this.config.fadingTime * 2) + this.config.fadingSpeed;
    const cycleDuration = fadeDuration * 1000;

    // Initial Animation starten
    const wrapperInit = document.querySelector(".MMM-Bitunix .bitunix-wrapper");
    if (wrapperInit) {
      wrapperInit.style.animation = `fadeInOut ${fadeDuration}s linear infinite`;
      wrapperInit.style.opacity = "1";
    }

    this.rotationInterval = setInterval(() => {
      // Nächsten Stock vorbereiten
      this.currentIndex = (this.currentIndex + 1) % this.state.stocks.length;
      this.currentStock = this.state.stocks[this.currentIndex];
      console.log("[MMM-Bitunix] Wechsle zu:", this.currentStock.symbol);

      // Sofort DOM aktualisieren – kein Blackout
      this.updateDom(0);

      // Animation neu triggern
      const wrapper = document.querySelector(".MMM-Bitunix .bitunix-wrapper");
      if (wrapper) {
        wrapper.style.animation = "none";
        void wrapper.offsetHeight; // Reflow für Restart
        wrapper.style.animation = `fadeInOut ${fadeDuration}s linear infinite`;
        wrapper.style.opacity = "1";
      }

      // Nach jedem Durchlauf: neue Preise holen
      if (this.currentIndex === 0) {
        console.log("[MMM-Bitunix] Durchlauf komplett - neue Preise holen");
        this.sendSocketNotification("BITUNIX_REQUEST_TICKERS", {
          stocks: this.config.stocks
        });
      }
    }, cycleDuration);
  },


  // Dezimalstellen basierend auf Preisgröße
  getDecimals(price) {
    if (price < 1) return 6;
    if (price < 10) return 4;
    if (price < 100) return 3;
    return 2;
  },

  // Nur Preis und Prozent im DOM updaten
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

  // Template-Daten vorbereiten
  getTemplateData() {
    let stock = null;
    if (this.currentStock && this.currentStock.symbol) {
      const decimals = this.getDecimals(this.currentStock.lastPrice);
      const fadeDuration =
        this.config.fadingTime + this.config.fadingSpeed + this.config.fadingTime;

      stock = {
        ...this.currentStock,
        decimals,
        cleanSymbol: this.currentStock.symbol.replace("USDT", ""),
        fadeDuration,
        fadingTime: this.config.fadingTime,
        fadingSpeed: this.config.fadingSpeed
      };
    }

    return {
      config: this.config,
      stock,
      lastUpdate: this.state.lastUpdate
        ? moment(this.state.lastUpdate).format("HH:mm:ss")
        : null
    };
  },

  // Animation resetten
  notificationReceived(notification) {
    if (notification === "DOM_OBJECTS_CREATED" || notification === "DOM_OBJECTS_UPDATED") {
      const wrapper = document.querySelector(".MMM-Bitunix .bitunix-wrapper");
      if (wrapper) {
        wrapper.style.animation = "none";
        setTimeout(() => {
          const fadeDuration = this.config.fadingSpeed + this.config.fadingTime;
          wrapper.style.animation = `fadeInOut ${fadeDuration}s ease-in-out forwards`;
        }, 10);
      }
    }
  }
});
