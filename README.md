Este repositório contém um modelo de Google Apps Script para integrar uma planilha do Google com aplicações externas via Web App. Copie o conteúdo de `apps-script.gs` para o editor do Apps Script vinculado à sua planilha e ajuste as configurações conforme necessário.
=======
# WhatsApp Lead Widget

Widget pronto para uso que capta informações de leads (nome, e-mail, consentimento e dados extras) antes de abrir uma conversa no WhatsApp. O componente foi pensado para ser facilmente incorporado em qualquer site estático ou aplicação existente.

## Recursos

- Botão flutuante com modal personalizado.
- Formulário com validação básica de nome e e-mail.
- Envio opcional dos dados para um endpoint (por exemplo, Google Apps Script).
- Registro de evento no Google Analytics 4 (opcional).
- Interceptação automática de links WhatsApp existentes na página.
- API pública para abrir o widget e alterar o número dinamicamente.

## Como usar

1. Copie o arquivo [`src/whatsapp-lead-widget.js`](src/whatsapp-lead-widget.js) para o seu projeto ou carregue-o via CDN próprio.
2. Inclua o script no final do `body` da sua página.
3. Em seguida, inicialize o widget com a configuração desejada:

```html
<script src="/caminho/para/whatsapp-lead-widget.js"></script>
<script>
  WhatsAppLeadWidget.init({
    scriptURL: "https://script.google.com/macros/s/SEU_SCRIPT/exec",
    whatsappNumber: "5511999999999",
    brandImage: "https://exemplo.com/logo.png",
    brandTitle: "Minha Marca",
    brandStatus: "online",
    privacyPolicyUrl: "https://exemplo.com/politica",
    interceptLinks: true,
    enableGA4: true,
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
    extraFields: {
      origem: "Website - WhatsApp Widget"
    }
  });
</script>
```

> Observação: o número do WhatsApp deve estar no formato `DDI + DDD + número`, contendo apenas dígitos.

## Exemplo

Um exemplo completo está disponível em [`example/index.html`](example/index.html). Abra o arquivo direto no navegador para testar a experiência.

## Personalização

- **Texts**: altere rótulos, mensagens e textos exibidos no modal.
- **Theme**: personalize cores de destaque, hover e elementos do formulário.
- **Interceptação de links**: habilite `interceptLinks: true` para que links `wa.me`, `api.whatsapp.com/send` e `whatsapp://send` abram o widget antes da conversa.
- **Campos extras**: adicione pares chave/valor em `extraFields` para enviar metadados ao seu backend.
- **API pública**: após inicializar o widget, é possível utilizar `WhatsAppLeadWidget.open(number?)`, `WhatsAppLeadWidget.setNumber(number)`, `WhatsAppLeadWidget.close()` e `WhatsAppLeadWidget.destroy()`.
- **Acessibilidade aprimorada**: o modal possui foco aprisionado e pode ser fechado com a tecla `Esc`, além de melhor suporte para leitores de tela.

## Desenvolvimento

- O código principal está em `src/whatsapp-lead-widget.js` e não depende de bundlers.
- Para visualizar alterações rapidamente, abra `example/index.html` com Live Server ou semelhante.
- Para publicar em um CDN, basta minificar o arquivo se desejar e disponibilizá-lo.

## Licença

[MIT](LICENSE)