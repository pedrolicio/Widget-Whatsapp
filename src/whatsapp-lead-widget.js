/*!
 * WhatsApp Lead Widget - Principal Script
 * ---------------------------------------
 * Este arquivo contém a implementação principal do widget de captação
 * de leads via WhatsApp. Ele foi reescrito com foco em organização,
 * legibilidade e extensibilidade, mantendo compatibilidade com o script
 * original compartilhado pelo cliente.
 *
 * Melhores práticas aplicadas:
 *  - Uso de classes ES6 e funções auxiliares puras para facilitar testes;
 *  - Injeção de estilos idempotente (não duplica CSS ao reinicializar);
 *  - API pública expandida com eventos customizados e métodos utilitários;
 *  - Tratamento de erros mais robusto e mensagens de log consistentes;
 *  - Possibilidade de pré-preencher campos via `prefill` e persistência
 *    opcional dos dados do visitante com `storageKey`.
 *
 * Para utilizar, inclua este script no site e configure o widget através
 * de `window.WhatsAppLeadWidget.init({ ... })`, conforme demonstrado na
 * documentação.
 */

(function initWhatsAppLeadWidget(global) {
  "use strict";

  const WIDGET_NAMESPACE = "WhatsAppLeadWidget";
  const CSS_ID = "wlw-styles";
  const LOG_PREFIX = `[${WIDGET_NAMESPACE}]`;

  /**
   * Converte qualquer valor para uma string contendo apenas dígitos.
   * @param {string|number} value
   * @returns {string}
   */
  const toDigits = (value) => (String(value ?? "").match(/\d+/g) || []).join("");

  /**
   * Seleciona o primeiro elemento que corresponde ao seletor informado.
   * @param {string} selector
   * @param {ParentNode} [ctx=document]
   * @returns {Element|null}
   */
  const $ = (selector, ctx) => (ctx || document).querySelector(selector);

  /**
   * Cria um elemento HTML com atributos opcionais.
   * @param {string} tag
   * @param {Record<string, string>} [attributes]
   * @returns {HTMLElement}
   */
  const createElement = (tag, attributes) => {
    const element = document.createElement(tag);
    if (attributes) {
      Object.keys(attributes).forEach((key) => {
        element.setAttribute(key, attributes[key]);
      });
    }
    return element;
  };

  /**
   * Realiza merge profundo entre objetos simples.
   * @template T
   * @param {T} target
   * @param {Partial<T>} source
   * @returns {T}
   */
  const mergeDeep = (target, source) => {
    const output = Array.isArray(target) ? [...target] : { ...target };
    Object.keys(source || {}).forEach((key) => {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        output[key] = mergeDeep(output[key] || {}, value);
      } else {
        output[key] = value;
      }
    });
    return output;
  };

  const TRACKING_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "gclid",
    "fbclid",
    "gbraid",
    "wbraid",
  ];

  const collectTrackingData = () => {
    const trackingData = {};
    const search = global.location?.search || "";
    if (search && typeof URLSearchParams === "function") {
      const params = new URLSearchParams(search);
      TRACKING_PARAMS.forEach((key) => {
        const value = params.get(key);
        if (value) {
          trackingData[key] = value;
        }
      });
    }

    const pageUrl = global.location?.href || "";
    if (pageUrl) {
      trackingData.page_url = pageUrl;
    }

    const referrer = global.document?.referrer || "";
    if (referrer) {
      trackingData.referrer = referrer;
    }

    return trackingData;
  };

  /**
   * Simplifica o disparo de logs.
   * @param {"log"|"warn"|"error"} level
   * @param {...unknown} args
   */
  const log = (level, ...args) => {
    if (typeof console[level] === "function") {
      console[level](LOG_PREFIX, ...args);
    }
  };

  const DEFAULT_TEXTS = {
    welcome: "Olá! Para continuarmos, informe seus dados :)",
    nameLabel: "Nome *",
    emailLabel: "Email *",
    phoneLabel: "Telefone *",
    consentLabel: "Aceito receber comunicados",
    submit: "Iniciar conversa",
    required: "Por favor, preencha os campos obrigatórios.",
    invalidEmail: "Por favor, informe um email válido.",
    invalidPhone: "Por favor, informe um telefone válido.",
    namePlaceholder: "Seu nome",
    emailPlaceholder: "seu@email",
    phonePlaceholder: "(11) 99999-9999",
  };

  const DEFAULT_CONTACT_FIELDS = {
    email: { enabled: true, required: true },
    phone: { enabled: false, required: true },
  };

  const DEFAULT_THEME = {
    primary: "#036d5f",
    primaryHover: "#02594d",
    bubbleBg: "#efeae2",
    inputBg: "#e7ffe7",
  };

  const DEFAULT_CONFIG = {
    scriptURL: "",
    whatsappNumber: "",
    brandImage: "",
    brandTitle: "Minha Marca",
    brandStatus: "online",
    privacyPolicyUrl: "#",
    interceptLinks: false,
    enableGA4: false,
    ipLookupTimeoutMs: 800,
    backgroundPattern:
      "https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png",
    extraFields: {},
    attachTo: "body",
    texts: DEFAULT_TEXTS,
    theme: DEFAULT_THEME,
    prefill: null,
    storageKey: null,
    storageExpirationMinutes: 60 * 24,
    contactFields: DEFAULT_CONTACT_FIELDS,
  };

  /**
   * Gera o HTML da estrutura interna do modal.
   * @param {Required<typeof DEFAULT_CONFIG>} cfg
   * @returns {string}
   */
  const formatLabel = (label, required) => {
    const baseLabel = String(label || "").replace(/\s*\*$/, "");
    return required ? `${baseLabel} *` : baseLabel;
  };

  const getModalMarkup = (cfg) => {
    const fields = [];
    fields.push(`
        <label class="wlw-label" for="wlw-name">${formatLabel(
          cfg.texts.nameLabel,
          true
        )}</label>
        <input id="wlw-name" class="wlw-input" type="text" name="nome" required placeholder="${
          cfg.texts.namePlaceholder || "Seu nome"
        }" autocomplete="name">
    `);

    if (cfg.contactFields.email.enabled) {
      const emailRequired = cfg.contactFields.email.required;
      fields.push(`
        <label class="wlw-label" for="wlw-email">${formatLabel(
          cfg.texts.emailLabel,
          emailRequired
        )}</label>
        <input id="wlw-email" class="wlw-input" type="email" name="email" ${
          emailRequired ? "required" : ""
        } placeholder="${cfg.texts.emailPlaceholder || "seu@email"}" autocomplete="email" inputmode="email">
      `);
    }

    if (cfg.contactFields.phone.enabled) {
      const phoneRequired = cfg.contactFields.phone.required;
      fields.push(`
        <label class="wlw-label" for="wlw-phone">${formatLabel(
          cfg.texts.phoneLabel,
          phoneRequired
        )}</label>
        <input id="wlw-phone" class="wlw-input" type="tel" name="telefone" ${
          phoneRequired ? "required" : ""
        } placeholder="${
          cfg.texts.phonePlaceholder || "(11) 99999-9999"
        }" autocomplete="tel" inputmode="tel">
      `);
    }

    return `
    <div class="wlw-header">
      <img class="wlw-avatar" src="${cfg.brandImage || ""}" alt="${
        cfg.brandTitle || ""
      }">
      <div class="wlw-header-info">
        <div class="wlw-title">${cfg.brandTitle || ""}</div>
        <div class="wlw-status">${cfg.brandStatus || ""}</div>
      </div>
      <button type="button" class="wlw-close" aria-label="Fechar">×</button>
    </div>
    <div class="wlw-body">
      <div class="wlw-msg">${cfg.texts.welcome || ""}</div>
      <form class="wlw-form" novalidate>
        ${fields.join("\n")}
        <div class="wlw-consent">
          <input id="wlw-consent" type="checkbox" name="consent">
          <label for="wlw-consent" class="wlw-consent-label">${cfg.texts.consentLabel}</label>
        </div>
        <button type="submit" class="wlw-submit">${cfg.texts.submit}</button>
      </form>
      <div class="wlw-footer">
        ${
          cfg.privacyPolicyUrl
            ? `<a href="${cfg.privacyPolicyUrl}" target="_blank" rel="noopener">Política de Privacidade</a>`
            : ""
        }
        <span>${cfg.privacyPolicyUrl ? " | " : ""}Powered by <a href="https://www.agenciaregex.com/" target="_blank" rel="noopener">Agência Regex</a></span>
      </div>
    </div>
  `;
  };

  /**
   * Injeta o CSS base do widget apenas uma vez.
   * @param {Required<typeof DEFAULT_CONFIG>} cfg
   */
  const ensureStyles = (cfg) => {
    if (document.getElementById(CSS_ID)) return;
    const style = createElement("style", { id: CSS_ID });
    const t = cfg.theme;
    style.textContent = `
      .wlw-modal { position: fixed; bottom: 20px; right: 20px; width: 340px; border: 1px solid #cacaca; border-radius: 6px; overflow: hidden; display: none; z-index: 9999; font-family: "Open Sans", Arial, sans-serif; background: #fff; box-shadow: 0 12px 30px rgba(0,0,0,0.18); }
      .wlw-header { background-color: ${t.primary}; color: #fff; padding: 12px; display: flex; align-items: center; position: relative !important; gap: 10px; }
      .wlw-header-info { flex: 1; }
      .wlw-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,0.2); }
      .wlw-title { font-size: 17px; font-weight: 700; line-height: 1.2; }
      .wlw-status { font-size: 13px; color: #c8f8c8; }
      .wlw-close { position: absolute !important; top: 10px !important; right: 10px !important; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 22px; line-height: 1; color: #fff !important; background: transparent !important; border: none !important; border-radius: 4px; box-shadow: none !important; padding: 0; appearance: none; }
      .wlw-body { background: ${t.bubbleBg} url('${cfg.backgroundPattern}') repeat; background-size: 300px; padding: 12px; }
      .wlw-msg { background: #fff; border: 1px solid #cacaca; border-radius: 6px; padding: 10px; color: #4a4a4a; margin-bottom: 10px; font-size: 14px; line-height: 1.5; }
      .wlw-form { display: flex; flex-direction: column; }
      .wlw-label { font-size: 14px; font-weight: 600; margin-bottom: 4px; color: #333; }
      .wlw-input { background-color: ${t.inputBg}; border: 1px solid #cacaca; border-radius: 6px; padding: 8px; margin-bottom: 10px; width: 100%; box-sizing: border-box; font-size: 14px; color: #222; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
      .wlw-input:focus { outline: none; border-color: ${t.primary}; box-shadow: 0 0 0 2px rgba(3,109,95,0.25); }
      .wlw-consent { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; font-size: 14px; color: #4a4a4a; }
      .wlw-consent input { width: 16px; height: 16px; }
      .wlw-consent-label { margin: 0; font-weight: normal; }
      .wlw-submit { background-color: ${t.primary} !important; color: #fff !important; border: none !important; border-radius: 6px !important; box-shadow: none !important; padding: 11px; font-size: 16px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: background-color 0.2s ease; }
      .wlw-submit:focus, .wlw-submit:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(3,109,95,0.3); }
      .wlw-submit:hover:not(:disabled) { background-color: ${t.primaryHover}; }
      .wlw-submit:disabled { opacity: 0.7; cursor: not-allowed; }
      .wlw-fab { position: fixed; z-index: 999; bottom: 20px; right: 20px; cursor: pointer; border: none !important; border-radius: 50% !important; background-color: transparent !important; color: ${t.primary} !important; box-shadow: none !important; padding: 0; }
      .wlw-fab:focus, .wlw-fab:focus-visible { outline: none; border-radius: 50%; box-shadow: 0 0 0 4px rgba(3,109,95,0.25); }
      .wlw-fab img { height: 60px; width: auto; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.25)); }
      .wlw-close:focus, .wlw-close:focus-visible { outline: none; border-radius: 6px; box-shadow: 0 0 0 3px rgba(3,109,95,0.25); }
      .wlw-consent input:focus, .wlw-consent input:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(3,109,95,0.25); }
      .wlw-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.6); border-radius: 50%; border-top-color: #fff; animation: wlwspin 0.6s linear infinite; }
      @keyframes wlwspin { to { transform: rotate(360deg); } }
      .wlw-footer { margin-top: 12px; font-size: 12px; text-align: center; color: #666; display: flex; justify-content: center; gap: 4px; flex-wrap: wrap; }
      .wlw-footer a { color: #666; text-decoration: none; }
      .wlw-footer a:focus, .wlw-footer a:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(3,109,95,0.25); border-radius: 4px; }
      .wlw-footer a:hover { text-decoration: underline; }
      @media (max-width: 420px) { .wlw-modal { width: calc(100% - 40px); right: 20px; left: 20px; } .wlw-fab img { height: 52px; } }
    `;
    document.head.appendChild(style);
  };

  /**
   * Normaliza a configuração e aplica valores padrão.
   * @param {Partial<typeof DEFAULT_CONFIG>} cfg
   * @returns {Required<typeof DEFAULT_CONFIG>}
   */
  const normalizeConfig = (cfg) => {
    const merged = mergeDeep(DEFAULT_CONFIG, cfg || {});
    merged.whatsappNumber = toDigits(merged.whatsappNumber);
    merged.texts = mergeDeep(DEFAULT_TEXTS, merged.texts || {});
    merged.theme = mergeDeep(DEFAULT_THEME, merged.theme || {});
    merged.contactFields = mergeDeep(
      DEFAULT_CONTACT_FIELDS,
      merged.contactFields || {}
    );
    ["email", "phone"].forEach((field) => {
      if (!merged.contactFields[field].enabled) {
        merged.contactFields[field].required = false;
      }
    });
    if (!merged.whatsappNumber) {
      log("warn", "'whatsappNumber' é obrigatório para o funcionamento correto.");
    }
    return /** @type {Required<typeof DEFAULT_CONFIG>} */ (merged);
  };

  /**
   * Lê dados persistidos localmente, se configurado.
   * @param {Required<typeof DEFAULT_CONFIG>} cfg
   * @returns {{ nome?: string; email?: string; telefone?: string; consent?: boolean } | null}
   */
  const readStorage = (cfg) => {
    if (!cfg.storageKey || !global.localStorage) return null;
    try {
      const raw = global.localStorage.getItem(cfg.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.expires && Date.now() > parsed.expires) {
        global.localStorage.removeItem(cfg.storageKey);
        return null;
      }
      return parsed.data || null;
    } catch (error) {
      log("warn", "Falha ao ler storage:", error);
      return null;
    }
  };

  /**
   * Persiste dados no storage local.
   * @param {Required<typeof DEFAULT_CONFIG>} cfg
   * @param {{ nome?: string; email?: string; telefone?: string; consent?: boolean }} data
   */
  const writeStorage = (cfg, data) => {
    if (!cfg.storageKey || !global.localStorage) return;
    try {
      const expires = cfg.storageExpirationMinutes
        ? Date.now() + cfg.storageExpirationMinutes * 60 * 1000
        : null;
      global.localStorage.setItem(
        cfg.storageKey,
        JSON.stringify({ data, expires })
      );
    } catch (error) {
      log("warn", "Falha ao salvar storage:", error);
    }
  };

  /**
   * Dispara eventos customizados para permitir integrações externas.
   * @param {HTMLElement} rootElement
   * @param {string} eventName
   * @param {Record<string, unknown>} detail
   */
  const dispatchEvent = (rootElement, eventName, detail = {}) => {
    const event = new CustomEvent(`${WIDGET_NAMESPACE.toLowerCase()}:${eventName}`, {
      detail,
      bubbles: true,
    });
    rootElement.dispatchEvent(event);
  };

  class WhatsAppLeadWidget {
    /**
     * @param {Partial<typeof DEFAULT_CONFIG>} [userConfig]
     */
    constructor(userConfig) {
      this.config = normalizeConfig(userConfig);
      this.runtimeNumber = this.config.whatsappNumber;

      /** @type {HTMLElement | null} */
      this.container = document.querySelector(this.config.attachTo) || document.body;
      if (!this.container) {
        log("error", "Elemento container não encontrado. Usando body como fallback.");
        this.container = document.body;
      }

      ensureStyles(this.config);

      this._buildFab();
      this._buildModal();
      this._bindEvents();
      this._applyPrefill();

      if (this.config.interceptLinks) {
        this._setupLinkInterceptor();
      }
    }

    /** Cria o botão flutuante (FAB). */
    _buildFab() {
      this.fab = createElement("button", {
        type: "button",
        class: "wlw-fab",
        "aria-label": "Abrir atendimento no WhatsApp",
      });
      this.fab.innerHTML =
        '<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp">';
      this.container.appendChild(this.fab);
    }

    /** Monta o modal principal. */
    _buildModal() {
      this.modal = createElement("div", {
        class: "wlw-modal",
        role: "dialog",
        "aria-modal": "true",
      });
      this.modal.innerHTML = getModalMarkup(this.config);
      this.container.appendChild(this.modal);
    }

    /** Aplica dados pré-preenchidos vindos do storage ou da configuração. */
    _applyPrefill() {
      const stored = readStorage(this.config);
      const prefill = mergeDeep(stored || {}, this.config.prefill || {});
      if (!prefill) return;

      if (prefill.nome) {
        const nameInput = $("#wlw-name", this.modal);
        if (nameInput) nameInput.value = prefill.nome;
      }
      if (prefill.email) {
        const emailInput = $("#wlw-email", this.modal);
        if (emailInput) emailInput.value = prefill.email;
      }
      if (prefill.telefone) {
        const phoneInput = $("#wlw-phone", this.modal);
        if (phoneInput) phoneInput.value = prefill.telefone;
      }
      if (typeof prefill.consent === "boolean") {
        const consentInput = $("#wlw-consent", this.modal);
        if (consentInput) consentInput.checked = prefill.consent;
      }
    }

    /** Configura os listeners de evento da UI. */
    _bindEvents() {
      this.fab.addEventListener("click", () => this.open());
      $(".wlw-close", this.modal)?.addEventListener("click", () => this.close());
      this.modal.addEventListener("submit", (ev) => this._handleSubmit(ev));
    }

    /**
     * Handler principal do submit do formulário.
     * @param {Event} event
     */
    async _handleSubmit(event) {
      event.preventDefault();

      const nameInput = /** @type {HTMLInputElement|null} */ (
        $("#wlw-name", this.modal)
      );
      const emailInput = /** @type {HTMLInputElement|null} */ (
        $("#wlw-email", this.modal)
      );
      const phoneInput = /** @type {HTMLInputElement|null} */ (
        $("#wlw-phone", this.modal)
      );
      const consentInput = /** @type {HTMLInputElement|null} */ (
        $("#wlw-consent", this.modal)
      );
      const submitBtn = $(".wlw-submit", this.modal);
      const form = /** @type {HTMLFormElement|null} */ (
        $(".wlw-form", this.modal)
      );

      const name = nameInput?.value.trim() || "";
      const email = emailInput?.value.trim() || "";
      const phone = phoneInput?.value.trim() || "";
      const consent = consentInput?.checked ? "Sim" : "Não";

      if (nameInput) {
        nameInput.value = name;
        if (typeof nameInput.setCustomValidity === "function") {
          nameInput.setCustomValidity("");
        }
      }
      if (emailInput) {
        emailInput.value = email;
        if (typeof emailInput.setCustomValidity === "function") {
          emailInput.setCustomValidity("");
        }
      }
      if (phoneInput) {
        phoneInput.value = phone;
        if (typeof phoneInput.setCustomValidity === "function") {
          phoneInput.setCustomValidity("");
        }
      }

      if (emailInput && email && !/^\S+@\S+\.\S+$/.test(email)) {
        emailInput.setCustomValidity(this.config.texts.invalidEmail);
      }

      if (phoneInput && phone) {
        const digits = toDigits(phone);
        if (digits.length < 8) {
          phoneInput.setCustomValidity(this.config.texts.invalidPhone);
        }
      }

      if (form && !form.reportValidity()) {
        return;
      }

      submitBtn?.setAttribute("disabled", "true");
      if (submitBtn) {
        submitBtn.innerHTML = `${this.config.texts.submit} <span class="wlw-spinner"></span>`;
      }

      writeStorage(this.config, {
        nome: name,
        email,
        telefone: phone,
        consent: consent === "Sim",
      });

      const waUrl = this._buildWhatsAppURL(
        name,
        email,
        phone,
        consent === "Sim"
      );
      const popup = global.open(waUrl, "_blank");

      const actionDate = new Date();
      const formattedActionDate = actionDate.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      });

      const payload = mergeDeep(
        mergeDeep(
          {
            nome: name,
            email,
            telefone: phone,
            consent,
            timestamp: formattedActionDate,
            "data/hora da ação": formattedActionDate,
            userAgent: global.navigator?.userAgent || "",
            pageUrl: global.location?.href || "",
          },
          collectTrackingData()
        ),
        this.config.extraFields || {}
      );

      dispatchEvent(this.modal, "submit", payload);

      try {
        const ip = await this._getUserIP();
        if (ip) payload.userIP = ip;
        await this._postLead(payload);
        this._trackGA("whatsappClick", {
          event_category: "engagement",
          event_label: "WhatsApp Form",
          value: 1,
        });
        dispatchEvent(this.modal, "success", payload);
        this._resetForm();
        this.close();
      } catch (error) {
        log("error", "Erro ao enviar dados", error);
        dispatchEvent(this.modal, "error", { error });
        alert("Ocorreu um erro ao enviar os dados. Tente novamente.");
        if (popup) {
          try {
            popup.close();
          } catch (_) {
            /* noop */
          }
        }
      } finally {
        if (submitBtn) {
          submitBtn.removeAttribute("disabled");
          submitBtn.textContent = this.config.texts.submit;
        }
      }
    }

    /** Reseta o formulário. */
    _resetForm() {
      const form = $(".wlw-form", this.modal);
      if (form) form.reset();
    }

    /**
     * Constrói a URL de atendimento do WhatsApp.
     * @param {string} name
     * @param {string} email
     * @param {boolean} consent
     */
    _buildWhatsAppURL(name, email, phone, consent) {
      const parts = [`Olá! Meu nome é ${name}.`];
      if (email) parts.push(`Email: ${email}`);
      if (phone) parts.push(`Telefone: ${phone}`);
      if (consent) parts.push("Aceitou receber comunicados.");
      const message = parts.join(" ");
      const number = this.runtimeNumber || this.config.whatsappNumber;
      const encoded = encodeURIComponent(message);
      return `https://wa.me/${number}?text=${encoded}`;
    }

    /** Obtém o IP do usuário com timeout configurável. */
    _getUserIP() {
      const timeout = this.config.ipLookupTimeoutMs;
      return new Promise((resolve) => {
        let fulfilled = false;
        const timer = setTimeout(() => {
          if (fulfilled) return;
          fulfilled = true;
          resolve("");
        }, timeout);

        fetch("https://api.ipify.org?format=json")
          .then((response) => response.json())
          .then((data) => {
            if (fulfilled) return;
            fulfilled = true;
            clearTimeout(timer);
            resolve(data?.ip || "");
          })
          .catch(() => {
            if (fulfilled) return;
            fulfilled = true;
            clearTimeout(timer);
            resolve("");
          });
      });
    }

    /** Envia os dados ao backend se `scriptURL` estiver configurado. */
    _postLead(payload) {
      if (!this.config.scriptURL) return Promise.resolve("skipped");
      const formData = new FormData();
      Object.keys(payload).forEach((key) => {
        const value = payload[key];
        if (value != null) {
          formData.append(key, value);
        }
      });
      return fetch(this.config.scriptURL, {
        method: "POST",
        body: formData,
      }).then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          if (text) {
            log("error", "Falha ao enviar lead", response.status, text);
          }
          const message = text?.trim() || `Request failed with status ${response.status}`;
          throw new Error(message);
        }
        if (text) {
          log("log", "Resposta do backend", text);
        }
        return text;
      });
    }

    /** Dispara evento GA4, se configurado. */
    _trackGA(eventName, params = {}) {
      if (!this.config.enableGA4 || !eventName) return;
      try {
        if (typeof global.gtag === "function") {
          global.gtag("event", eventName, params);
        } else {
          const normalizeKey = (key) =>
            key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          const dataLayerParams = Object.keys(params).reduce(
            (acc, key) => ({
              ...acc,
              [normalizeKey(key)]: params[key],
            }),
            { event: eventName }
          );
          global.dataLayer = global.dataLayer || [];
          global.dataLayer.push(dataLayerParams);
        }
      } catch (error) {
        log("warn", "Falha ao enviar evento GA4", error);
      }
    }

    /** Habilita o interceptador de links de WhatsApp. */
    _setupLinkInterceptor() {
      if (this._linkHandler) return;

      this._linkHandler = (event) => {
        const anchor = event.target?.closest?.("a[href]");
        if (!anchor || anchor.hasAttribute("data-skip-wa-widget")) return;
        const href = anchor.getAttribute("href") || "";
        if (!this._isWhatsAppLink(href)) return;
        event.preventDefault();
        const number = this._extractNumber(href);
        this.open(number || undefined);
      };

      document.addEventListener("click", this._linkHandler, true);
    }

    /** Remove o interceptador de links. */
    _removeLinkInterceptor() {
      if (!this._linkHandler) return;
      document.removeEventListener("click", this._linkHandler, true);
      this._linkHandler = null;
    }

    /** Valida se a URL é um link de WhatsApp. */
    _isWhatsAppLink(href) {
      return /wa\.me\/\d+/i.test(href)
        || /api\.whatsapp\.com\/send/i.test(href)
        || /^whatsapp:\/\/send/i.test(href);
    }

    /** Extrai o número de telefone de uma URL do WhatsApp. */
    _extractNumber(href) {
      const match1 = href.match(/wa\.me\/(\d+)/i);
      if (match1?.[1]) return toDigits(match1[1]);
      const match2 = href.match(/[?&#]phone=([^&#]+)/i);
      if (match2?.[1]) return toDigits(decodeURIComponent(match2[1]));
      const match3 = href.match(/^whatsapp:\/\/send\?.*?phone=([^&#]+)/i);
      if (match3?.[1]) return toDigits(decodeURIComponent(match3[1]));
      return "";
    }

    /** Abre o modal do widget. */
    open(number) {
      if (number) {
        this.setNumber(number);
      } else {
        this.runtimeNumber = this.config.whatsappNumber;
      }

      this.modal.style.display = "block";
      this.fab?.setAttribute("aria-expanded", "true");
      const nameInput = $("#wlw-name", this.modal);
      nameInput?.focus();
      dispatchEvent(this.modal, "open", { number: this.runtimeNumber });
      this._trackGA("whatsappWidgetOpen", {
        event_category: "engagement",
        event_label: "WhatsApp Widget",
        value: 1,
        widget_number: this.runtimeNumber,
      });
    }

    /** Fecha o modal do widget. */
    close() {
      this.modal.style.display = "none";
      this.fab?.setAttribute("aria-expanded", "false");
      dispatchEvent(this.modal, "close", {});
    }

    /** Define dinamicamente o número do atendimento. */
    setNumber(number) {
      this.runtimeNumber = toDigits(number);
    }

    /** Atualiza a configuração do widget em tempo de execução. */
    updateConfig(partialConfig) {
      this.config = normalizeConfig(mergeDeep(this.config, partialConfig));
      ensureStyles(this.config);
      this.modal.innerHTML = getModalMarkup(this.config);
      this._bindEvents();
      this._applyPrefill();
      dispatchEvent(this.modal, "update", this.config);
    }

    /** Destrói o widget, removendo elementos e listeners. */
    destroy() {
      this._removeLinkInterceptor();
      this.fab?.remove();
      this.modal?.remove();
      dispatchEvent(document.body, "destroy", {});
    }
  }

  let instance = null;

  const namespace = (global[WIDGET_NAMESPACE] = global[WIDGET_NAMESPACE] || {});

  namespace.init = function init(userConfig) {
    if (instance) {
      if (userConfig?.whatsappNumber) {
        instance.setNumber(userConfig.whatsappNumber);
      }
      return instance;
    }

    const start = () => {
      instance = new WhatsAppLeadWidget(userConfig);
      namespace.open = instance.open.bind(instance);
      namespace.close = instance.close.bind(instance);
      namespace.setNumber = instance.setNumber.bind(instance);
      namespace.updateConfig = instance.updateConfig.bind(instance);
      namespace.destroy = () => {
        instance?.destroy();
        instance = null;
        delete namespace.open;
        delete namespace.close;
        delete namespace.setNumber;
        delete namespace.updateConfig;
        delete namespace.destroy;
      };
      return instance;
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }

    return instance;
  };
})(window);

