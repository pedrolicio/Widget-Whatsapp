/*! WhatsApp Lead Widget - Generic v1.0 | MIT */
(function(root){
  "use strict";

  var _instance = null;

  function toDigits(s){ return (String(s||"").match(/\d+/g)||[]).join(""); }
  function $(sel, ctx){ return (ctx||document).querySelector(sel); }
  function createEl(tag, attrs){ var el=document.createElement(tag); if(attrs){ Object.keys(attrs).forEach(function(k){ el.setAttribute(k, attrs[k]); }); } return el; }

  function mergeDeep(target, source){
    var t = Object(target), s = Object(source);
    Object.keys(s).forEach(function(k){
      var value = s[k];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        t[k] = mergeDeep(t[k] || {}, value);
      } else if (Array.isArray(value)) {
        t[k] = value.slice();
      } else {
        t[k] = value;
      }
    });
    return t;
  }

  var DEFAULTS = {
    scriptURL: "",
    whatsappNumber: "",
    brandImage: "",
    brandTitle: "Minha Marca",
    brandStatus: "online",
    privacyPolicyUrl: "#",
    interceptLinks: false,
    enableGA4: false,
    texts: {
      welcome: "Olá! Para continuarmos, informe seu e-mail :)",
      nameLabel: "Nome *",
      emailLabel: "Email *",
      consentLabel: "Aceito receber comunicados",
      submit: "Iniciar conversa",
      required: "Por favor, preencha Nome e Email."
    },
    theme: {
      primary: "#036d5f",
      primaryHover: "#02594d",
      bubbleBg: "#efeae2",
      inputBg: "#e7ffe7"
    },
    ipLookupTimeoutMs: 800,
    backgroundPattern: "https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png",
    extraFields: {},
    attachTo: "body"
  };

  function Widget(userCfg){
    this.cfg = mergeDeep(JSON.parse(JSON.stringify(DEFAULTS)), userCfg || {});
    this.cfg.whatsappNumber = toDigits(this.cfg.whatsappNumber);
    this.runtimeNumber = this.cfg.whatsappNumber;

    if (!this.cfg.whatsappNumber) {
      console.warn("[WhatsAppLeadWidget] 'whatsappNumber' é obrigatório.");
    }
    this.container = document.querySelector(this.cfg.attachTo) || document.body;
    this._build();
    if (this.cfg.interceptLinks) this._setupLinkInterceptor();
  }

  Widget.prototype._injectCSS = function(){
    var c = this.cfg, t = c.theme;
    var existing = document.head.querySelector('style[data-wlw-style]');
    if (existing) {
      this.styleTag = existing;
      return;
    }
    var css = `
      .wlw-modal { position: fixed; bottom: 20px; right: 20px; width: 340px;
        border: 1px solid #cacaca; border-radius: 6px; overflow: hidden;
        display: none; z-index: 9999; font-family: "Open Sans", Arial, sans-serif; background: #fff; }
      .wlw-header { background-color: ${t.primary}; color: #fff; padding: 10px; display: flex; align-items: center; position: relative; }
      .wlw-avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 10px; object-fit: cover; }
      .wlw-title { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
      .wlw-status { font-size: 13px; color: #c8f8c8; }
      .wlw-close { position: absolute; top: 10px; right: 10px; cursor: pointer; font-size: 20px; color: #fff; }
      .wlw-body { background: ${t.bubbleBg} url('${c.backgroundPattern}') repeat; background-size: 300px; padding: 10px; }
      .wlw-msg { background: #fff; border: 1px solid #cacaca; border-radius: 6px; padding: 10px; color: #4a4a4a; margin-bottom: 10px; font-size: 14px; }
      .wlw-form { display: flex; flex-direction: column; }
      .wlw-label { font-size: 14px; font-weight: 700; margin-bottom: 5px; }
      .wlw-input { background-color: ${t.inputBg}; border: 1px solid #cacaca; border-radius: 6px; padding: 8px; margin-bottom: 10px;
        width: 100%; box-sizing: border-box; font-size: 14px; color: #4a4a4a; }
      .wlw-consent { display: flex; align-items: center; margin-bottom: 10px; font-size: 14px; color: #4a4a4a; }
      .wlw-submit { background-color: ${t.primary}; color: #fff; border: none; border-radius: 6px; padding: 10px; font-size: 16px; cursor: pointer; }
      .wlw-submit:hover { background-color: ${t.primaryHover}; }
      .wlw-fab { position: fixed; z-index: 999; bottom: 20px; right: 20px; cursor: pointer; border: 0; background: transparent; padding: 0; }
      .wlw-fab img { height: 60px; width: auto; }
      .wlw-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.6);
        border-radius: 50%; border-top-color: #fff; animation: wlwspin 0.6s linear infinite; margin-left: 5px; }
      @keyframes wlwspin { to { transform: rotate(360deg); } }
      .wlw-footer { margin-top: 10px; font-size: 12px; text-align: center; color: #666; }
      .wlw-footer a { color: #666; text-decoration: none; }
      .wlw-footer a:hover { text-decoration: underline; }
      @media (max-width: 420px) { .wlw-modal { width: calc(100% - 40px); right: 20px; left: 20px; } }
    `;
    var style = createEl("style", { "data-wlw-style": "true" });
    style.textContent = css;
    document.head.appendChild(style);
    this.styleTag = style;
  };

  Widget.prototype._build = function(){
    var c = this.cfg;

    this._injectCSS();

    this.fab = createEl("button", { type:"button", class:"wlw-fab", "aria-label":"Abrir atendimento no WhatsApp" });
    this.fab.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp">';
    this.container.appendChild(this.fab);

    this.modal = createEl("div", {
      class:"wlw-modal",
      role:"dialog",
      "aria-modal":"true",
      "aria-hidden":"true",
      tabindex:"-1"
    });
    this.modal.innerHTML = [
      '<div class="wlw-header">',
        '<img class="wlw-avatar" src="'+(c.brandImage||"")+'" alt="'+(c.brandTitle||"")+'">',
        '<div>',
          '<div class="wlw-title" id="wlw-title">'+(c.brandTitle||"")+'</div>',
          '<div class="wlw-status" id="wlw-status">'+(c.brandStatus||"")+'</div>',
        '</div>',
        '<button type="button" class="wlw-close" aria-label="Fechar modal">×</button>',
      '</div>',
      '<div class="wlw-body" aria-labelledby="wlw-title" aria-describedby="wlw-description">',
        '<div class="wlw-msg" id="wlw-description">'+(c.texts.welcome||"")+'</div>',
        '<form class="wlw-form" novalidate>',
          '<label class="wlw-label" for="wlw-name">'+(c.texts.nameLabel||"Nome *")+'</label>',
          '<input id="wlw-name" class="wlw-input" type="text" name="nome" required placeholder="Seu nome" autocomplete="name" minlength="2">',
          '<label class="wlw-label" for="wlw-email">'+(c.texts.emailLabel||"Email *")+'</label>',
          '<input id="wlw-email" class="wlw-input" type="email" name="email" required placeholder="seu@email" autocomplete="email" inputmode="email">',
          '<div class="wlw-consent">',
            '<input id="wlw-consent" type="checkbox" name="consent">',
            '<label for="wlw-consent" style="margin:0; font-weight: normal;">'+(c.texts.consentLabel||"Aceito receber comunicados")+'</label>',
          '</div>',
          '<button type="submit" class="wlw-submit">'+(c.texts.submit||"Iniciar conversa")+'</button>',
        '</form>',
        '<div class="wlw-footer">',
          (c.privacyPolicyUrl ? '<a href="'+c.privacyPolicyUrl+'" target="_blank" rel="noopener">Política de Privacidade</a>' : ''),
          '<span> '+(c.privacyPolicyUrl ? ' | ' : '')+'Powered by <a href="https://www.agenciaregex.com/" target="_blank" rel="noopener">Agência Regex</a></span>',
        '</div>',
      '</div>'
    ].join("");
    this.container.appendChild(this.modal);

    var self = this;
    this.fab.addEventListener("click", function(){ self.open(); });
    this.closeBtn = $('.wlw-close', this.modal);
    this.closeBtn.addEventListener("click", function(){ self.close(); });
    this.formEl = $('.wlw-form', this.modal);
    this.formEl.addEventListener("submit", this._onSubmit.bind(this));
    this._handleKeydown = this._onKeydown.bind(this);
    document.addEventListener("keydown", this._handleKeydown);

    root.WhatsAppLeadWidget = root.WhatsAppLeadWidget || {};
    root.WhatsAppLeadWidget.open = this.open.bind(this);
    root.WhatsAppLeadWidget.setNumber = this.setNumber.bind(this);
    root.WhatsAppLeadWidget.destroy = this.destroy.bind(this);
    root.WhatsAppLeadWidget.close = this.close.bind(this);
  };

  Widget.prototype._trackGA = function(){
    if (!this.cfg.enableGA4) return;
    try {
      if (typeof root.gtag === "function") {
        root.gtag("event", "whatsappClick", {
          event_category: "engagement",
          event_label: "WhatsApp Form",
          value: 1
        });
      } else {
        root.dataLayer = root.dataLayer || [];
        root.dataLayer.push({
          event: "whatsappClick",
          eventCategory: "engagement",
          eventLabel: "WhatsApp Form",
          value: 1
        });
      }
    } catch(_) {}
  };

  Widget.prototype._getIP = function(timeoutMs){
    var ms = typeof timeoutMs === "number" ? timeoutMs : this.cfg.ipLookupTimeoutMs;
    return new Promise(function(resolve){
      var done=false;
      var t=setTimeout(function(){ if(!done){done=true;resolve("");}}, ms);
      if (typeof fetch !== "function") {
        clearTimeout(t);
        resolve("");
        return;
      }
      fetch("https://api.ipify.org?format=json").then(function(r){return r.json();}).then(function(j){
        if(!done){done=true;clearTimeout(t);resolve(j.ip||"");}
      }).catch(function(){ if(!done){done=true;clearTimeout(t);resolve("");}});
    });
  };

  Widget.prototype._postLead = function(payload){
    if (!this.cfg.scriptURL) return Promise.resolve("skip-post");
    var fd = new FormData();
    Object.keys(payload).forEach(function(k){ if (payload[k] != null) fd.append(k, payload[k]); });
    if (typeof fetch !== "function") {
      return Promise.reject(new Error("Fetch API indisponível"));
    }
    return fetch(this.cfg.scriptURL, { method:"POST", body: fd }).then(function(r){
      if (!r.ok) throw new Error("HTTP "+r.status);
      return r.text();
    });
  };

  Widget.prototype._onSubmit = function(e){
    e.preventDefault();
    if (!this.formEl.checkValidity()) {
      if (this.formEl.reportValidity) this.formEl.reportValidity();
      else alert(this.cfg.texts.required);
      return;
    }
    var name = $('#wlw-name', this.modal).value.trim();
    var email = $('#wlw-email', this.modal).value.trim();
    var consent = $('#wlw-consent', this.modal).checked ? "Sim" : "Não";

    var btn = $('.wlw-submit', this.modal);
    btn.disabled = true;
    btn.innerHTML = (this.cfg.texts.submit || "Iniciar conversa")+' <span class="wlw-spinner"></span>';

    var msg = "Olá! Meu nome é " + name + ". Email: " + email + (consent === "Sim" ? ". Aceitou receber comunicados." : "");
    var encoded = encodeURIComponent(msg);

    var number = this.runtimeNumber || this.cfg.whatsappNumber;
    var waUrl = "https://wa.me/" + number + "?text=" + encoded;
    var win = window.open(waUrl, "_blank");
    if (!win) {
      root.location.href = waUrl;
    }

    var payload = mergeDeep({
      nome: name,
      email: email,
      consent: consent,
      timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      userAgent: navigator.userAgent || "",
      pageUrl: location.href
    }, (this.cfg.extraFields || {}));

    var self = this;
    this._getIP().then(function(ip){
      if (ip) payload.userIP = ip;
      return self._postLead(payload);
    }).then(function(){
      self._trackGA();
      self.close();
      btn.disabled = false;
      btn.textContent = (self.cfg.texts.submit || "Iniciar conversa");
      self.formEl.reset();
    }).catch(function(err){
      console.error("[WhatsAppLeadWidget] Erro ao enviar dados:", err);
      alert("Ocorreu um erro ao enviar os dados. Tente novamente.");
      btn.disabled = false;
      btn.textContent = (self.cfg.texts.submit || "Iniciar conversa");
      if (win) { try { win.close(); } catch(_){} }
    });
  };

  Widget.prototype._setupLinkInterceptor = function(){
    var self = this;

    function isWhatsAppLink(href){
      if (!href) return false;
      return /wa\.me\/\d+/i.test(href)
          || /api\.whatsapp\.com\/send/i.test(href)
          || /^whatsapp:\/\/send/i.test(href);
    }
    function extractNumber(href){
      if (!href) return "";
      var m1 = href.match(/wa\.me\/(\d+)/i);                         if (m1 && m1[1]) return toDigits(m1[1]);
      var m2 = href.match(/[?&#]phone=([^&#]+)/i);                    if (m2 && m2[1]) return toDigits(decodeURIComponent(m2[1]));
      var m3 = href.match(/^whatsapp:\/\/send\?.*?phone=([^&#]+)/i);  if (m3 && m3[1]) return toDigits(decodeURIComponent(m3[1]));
      return "";
    }

    this._interceptHandler = function(e){
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      if (a.hasAttribute("data-skip-wa-widget")) return;
      var href = a.getAttribute("href") || "";
      if (!isWhatsAppLink(href)) return;
      e.preventDefault();
      var num = extractNumber(href);
      self.open(num || undefined);
    };
    document.addEventListener("click", this._interceptHandler, true);
  };

  Widget.prototype.open = function(number){
    if (number) this.runtimeNumber = toDigits(number);
    else this.runtimeNumber = this.cfg.whatsappNumber;
    this.modal.style.display = "block";
    this.modal.setAttribute("aria-hidden", "false");
    this.fab.setAttribute("aria-expanded", "true");
    var nameEl = $('#wlw-name', this.modal);
    if (nameEl) nameEl.focus();
  };

  Widget.prototype.close = function(){
    this.modal.style.display = "none";
    this.modal.setAttribute("aria-hidden", "true");
    this.fab.setAttribute("aria-expanded", "false");
    this.fab.focus();
  };

  Widget.prototype._onKeydown = function(e){
    if (e.key === "Escape" && this.modal.style.display === "block") {
      e.preventDefault();
      this.close();
    }
    var nameEl = $('#wlw-name', this.modal);
    if (e.key === "Tab" && this.modal.style.display === "block") {
      var focusable = this.modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      focusable = Array.prototype.slice.call(focusable).filter(function(el){ return !el.disabled && el.offsetParent !== null; });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  Widget.prototype.setNumber = function(number){
    this.runtimeNumber = toDigits(number);
  };

  Widget.prototype.destroy = function(){
    try {
      this.fab && this.fab.remove();
      this.modal && this.modal.remove();
    } catch(_) {}
    if (this._handleKeydown) document.removeEventListener("keydown", this._handleKeydown);
    if (this._interceptHandler) document.removeEventListener("click", this._interceptHandler, true);
    delete root.WhatsAppLeadWidget.open;
    delete root.WhatsAppLeadWidget.setNumber;
    delete root.WhatsAppLeadWidget.destroy;
    delete root.WhatsAppLeadWidget.close;
    _instance = null;
  };

  root.WhatsAppLeadWidget = root.WhatsAppLeadWidget || {};
  root.WhatsAppLeadWidget.init = function(userCfg){
    if (_instance) {
      if (userCfg && userCfg.whatsappNumber) _instance.setNumber(userCfg.whatsappNumber);
      return _instance;
    }

    function start(){
      _instance = new Widget(userCfg);
      return _instance;
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  };

})(window);
