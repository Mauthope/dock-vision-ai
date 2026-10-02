# Catalogo de Agentes Reutilizaveis

Este repositório reúne especificações de agentes inteligentes em formato Markdown (`.md`) para inicialização, segurança, desenvolvimento e arquitetura de projetos em múltiplos ecossistemas.

---

## Agentes Disponíveis

| Agente | Arquivo | Responsabilidade Principal | Agentes Relacionados |
| :--- | :--- | :--- | :--- |
| **Start Agent** | [`start.md`](./start.md) | Inicialização completa de projetos Next.js (App Router), arquitetura multi-tenant, design system dos projetos **Qualidade & Bahia** (fontes Outfit/Inter, ambient mesh, glassmorphism com hover ciano), suporte a temas Claro/Escuro, criação de repositório no GitHub e orquestração. | `cleancod`, `security-expert` |
| **Clean Code & Lean** | [`cleancod.md`](./cleancod.md) | Especialista sênior em boas práticas, código limpo, eliminação de desperdício (Lean), proibição total de emojis nos sistemas, modularidade extrema (máx 150 linhas/arquivo) e economia de tokens para agentes de IA. | `start`, `security-expert` |
| **Copywriter & UX Writer** | [`copywriter.md`](./copywriter.md) | Especialista em redação de interfaces, escaneabilidade, microcopy enxuto, eliminação de acúmulo de textos e consenso obrigatório com o `designer` para validação de cards e telas. | `designer`, `cleancod` |
| **Designer (UI/UX)** | [`designer.md`](./designer.md) | O artista visual e maestro de UI/UX: estética de alto impacto, domínio e genialidade (estilo Qualidade & Bahia, Dual Theme, glassmorphism de precisão) e biblioteca viva de referências. | `copywriter`, `start` |
| **Security Expert** | [`security-expert.md`](./security-expert.md) | Auditor sênior de AppSec para SaaS comercial e escalável: isolamento multi-tenant hermético (RLS), blindagem agnóstica de provedores de IA, cabeçalhos HTTP, prevenção de IDOR e zero emojis. | `start`, `cleancod` |

---

## Diretrizes Globais Obrigatórias

Todos os agentes deste catálogo devem seguir estas regras transversais:
1. **Zero Emojis nos Sistemas:** É terminantemente proibido o uso de emojis em interfaces de usuário, botões, modais, headers, cards, toasts, logs de console ou mensagens de commit. Utilizar exclusivamente ícones vetoriais da biblioteca `lucide-react` ou rótulos semânticos de texto.
2. **Economia de Tokens de IA:** Manter arquivos concisos (100 a 150 linhas), funções curtas (20 a 30 linhas) e tipos bem definidos para facilitar leituras rápidas e edições de outros agentes com custo mínimo de contexto.
3. **Identidade Visual High-Tech:** Adotar o padrão visual dos projetos Qualidade e Bahia (gradientes radiais sutis, glassmorphism com `.glow-card`, tipografia Outfit/Inter e suporte nativo a temas Claro e Escuro).

---

## Como Utilizar

Você pode carregar ou referenciar estes arquivos em qualquer agente ou ferramenta de IA compatível (como Antigravity, Cursor, Claude Code, Copilot, ChatGPT ou scripts de automação):

1. **Para inicializar um novo projeto:**
   - Execute o prompt/agente [`start.md`](./start.md) passando o nome do projeto e o escopo desejado.
2. **Encadeamento de Agentes:**
   - O `start.md` cria a estrutura, aciona o `cleancod.md` para sanear e modularizar o código, e em seguida transfere o contexto para o `security-expert.md` para blindagem antes do push final.
