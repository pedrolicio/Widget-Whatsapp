# WhatsApp Lead Widget

Widget pronto para uso que capta informações de leads (nome, e-mail, telefone, consentimento e dados extras) antes de abrir uma
conversa no WhatsApp. O componente foi pensado para ser facilmente incorporado em qualquer site estático ou aplicação existente.

Este repositório também inclui um modelo mínimo de Google Apps Script (`apps-script.gs`). Ele grava no Google Sheets os dados
recebidos via `e.parameter`, exatamente como no snippet compartilhado pelo cliente. Copie o arquivo para o editor do Apps Script
da sua planilha, preencha as chaves de configuração (`spreadsheetId`, `sheetName` e a ordem das colunas) e publique o Web App.

## Recursos

- Botão flutuante com modal personalizado.
- Formulário com campos de e-mail e telefone configuráveis.
- Envio opcional dos dados para um endpoint (por exemplo, Google Apps Script).
- Registro de evento no Google Analytics 4 (opcional).
- Interceptação automática de links WhatsApp existentes na página.
- API pública para abrir o widget e alterar o número dinamicamente.

## Como usar

1. Copie o arquivo [`src/whatsapp-lead-widget.js`](src/whatsapp-lead-widget.js) para o seu projeto ou carregue-o via CDN próprio.
2. Inclua o script no final do `body` da sua página.
3. Em seguida, inicialize o widget com a configuração desejada:

![Preview do widget](docs/widget.png)

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
    contactFields: {
      email: { enabled: true, required: true },
      phone: { enabled: false, required: true }
    },
    texts: {
      welcome: "Olá! Para continuarmos, informe seus dados :)",
      nameLabel: "Nome",
      emailLabel: "Email",
      phoneLabel: "Telefone",
      consentLabel: "Aceito receber comunicados",
      submit: "Iniciar conversa",
      required: "Por favor, preencha os campos obrigatórios.",
      emailPlaceholder: "nome@empresa.com",
      phonePlaceholder: "(11) 98888-7777"
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

### Configurar a planilha do Google Sheets

1. Acesse o [Google Sheets](https://docs.google.com/spreadsheets/) e crie uma nova planilha em branco.
2. Renomeie a aba principal para algo fácil de identificar, por exemplo `Leads`.
3. Na linha de cabeçalho (células `A1` em diante), preencha os rótulos exatamente na mesma ordem definida em `CONFIG.columns` do
   arquivo `apps-script.gs`. O modelo padrão considera: `nome`, `email`, `telefone`, `consent`, `timestamp`, `data/hora da ação`,
   `userAgent`, `pageUrl`, `gclid`, `fbclid`, `gbraid`, `wbraid`, `utm_source`, `utm_medium`, `utm_campaign`, `referrer`,
   `page_url`, `userIP`.
4. Caso deseje armazenar outros metadados enviados pelo widget, adicione novas colunas após `userIP` e inclua objetos
   correspondentes no array `columns` (ex.: `{ key: 'minhaChave' }`).
5. Compartilhe a planilha com o mesmo usuário que será utilizado no Google Apps Script (ou defina permissões conforme necessário)
   para garantir que o script possa gravar os dados.

### Conectar com o Apps Script

1. Abra o editor do [Google Apps Script](https://script.google.com/) a partir da planilha.
2. Apague qualquer conteúdo existente e cole o código de [`apps-script.gs`](apps-script.gs).
3. Atualize `CONFIG.spreadsheetId` com o ID da planilha (trecho entre `/d/` e `/edit` na URL) e, se necessário, ajuste `sheetName`
   e a ordem das colunas.
4. Salve o projeto e clique em **Executar → doPost** uma vez para autorizar o acesso à planilha.
5. Implante como **App da Web** escolhendo executar como você e liberar acesso para "Qualquer pessoa com uma Conta do Google"
   (ou outra opção que atenda ao seu caso).
6. Copie a **URL do App da Web** gerada e informe-a na propriedade `scriptURL` ao inicializar o widget.

> Como o Apps Script lê apenas `e.parameter`, ele funciona imediatamente com o `FormData` enviado pelo widget — não é preciso
> habilitar CORS manualmente nem fazer parsing de JSON.

#### Exemplo de `doPost`

O arquivo `apps-script.gs` inclui um `doPost` completo e pronto para uso. Abaixo está um trecho simplificado para consulta:

```js
function doPost(e) {
  var sheet = SpreadsheetApp.openById('SUA_PLANILHA_ID').getSheetByName('Leads');
  var params = e.parameter;
  sheet.appendRow([
    new Date(),
    params.nome || '',
    params.email || '',
    params.telefone || '',
    params.consent === 'true',
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Exemplo

Um exemplo completo está disponível em [`example/index.html`](example/index.html). Abra o arquivo direto no navegador para testar a experiência.

## Personalização

- **Texts**: altere rótulos, mensagens e textos exibidos no modal.
- **Campos de contato**: utilize `contactFields` para escolher entre capturar e-mail, telefone ou ambos, além de definir se cada um deve ser obrigatório.

### Configurando obrigatoriedade dos campos

O objeto `contactFields` controla tanto quais campos serão exibidos quanto a obrigatoriedade de cada um. O nome é sempre obrigatório e exibido; já e-mail e telefone podem ser habilitados ou não por meio da flag `enabled`. Quando um campo está desabilitado (`enabled: false`), a configuração `required` é ignorada automaticamente pelo widget.

```js
contactFields: {
  email: { enabled: true, required: true },
  phone: { enabled: true, required: true }
}
```
