# VisionAi 🚚⏱️ (Sistema Inteligente de Docas & Cronoanálise)

Sistema Web responsivo de alta performance desenvolvido em **Next.js**, combinando o design moderno em **Dark Slate & Glassmorphism** (inspirado no projeto `Bahia`) com o poder do motor de **Visão Computacional em Tempo Real** (inspirado no projeto `Toten`).

⚡ **Desenvolvido por Mauricio Grigol**

---

## ✨ Destaques & Principais Funcionalidades

### 1. 🎯 Detecção 100% Precisa Estritamente Dentro dos Boxes Desenhados
A maior dificuldade histórica em sistemas de monitoramento por visão computacional é evitar disparos falsos causados por veículos apenas passando ao lado da vaga ou falsos encerramentos por oclusões temporárias. O **VisionAi** resolve isso combinando 4 camadas matemáticas:

1. **Coordenadas Normalizadas (0.0 a 1.0)**:
   * O usuário pode desenhar retângulos ou polígonos de 4 pontos em qualquer resolução ou tamanho de tela.
   * Não há distorção se a janela for redimensionada ou se o dispositivo alternar de orientação.
2. **Ponto de Contato com o Solo (Ground Contact / Wheelbase)**:
   * Em vez de testar o topo da cabine ou o baú (que projetam sombra fora da vaga devido ao ângulo da câmera), o algoritmo testa o ponto exato onde os eixos e as rodas tocam o solo `(x + w/2, y + h * 0.90)`.
3. **Algoritmo de Ray-Casting & Amostragem em Grade de Densidade (Grid Overlap)**:
   * Calcula a porcentagem real de volume que repousa sobre a vaga delimitada.
   * Suporta polígonos de qualquer ângulo para compensar a perspectiva tridimensional da câmera de segurança.
4. **Histerese e Debounce Temporal (Estabilidade Real)**:
   * Confirmação de entrada após frames consecutivos para ignorar ruídos ou pedestres passando.
   * Tolerância de ausência configurável (ex: 3.5 segundos) antes de considerar a saída e fechar o cronômetro oficial.

---

### 2. ⏱️ Cronômetro em Tempo Real e Auditoria Automática
* **Disparo Automático**: Ao detectar o caminhão atracado no boxe, o cronômetro inicia em tempo real com indicador visual pulsante.
* **Liberação e Registro**: Quando o caminhão se retira, o tempo total é automaticamente gravado no histórico de auditoria com horários exatos de entrada, saída, duração formatada (`MM:SS`) e nível de confiança da IA.
* **Alertas Sonoros Industriais**: Bipes sintetizados via Web Audio API (sem dependência de arquivos externos).

---

### 3. 📊 Dashboard Executivo & Gestão Lean / Kaizen
* **Tempo Médio de Permanência por Boxe**: Comparado diretamente com a meta industrial de atendimento.
* **Taxa de Ocupação Instantânea**: Visualização das docas livres e em carregamento.
* **Exportação Completa**: Download de relatórios em formato CSV (compatível com Excel) e backup JSON em 1 clique.

---

### 4. 📱 Interatividade Multi-Aparelho & Preparado para Câmeras IP
* **Smartphones Conectados**: Qualquer operador com celular pode abrir o link gerado, ligar a câmera traseira e transformar o aparelho na Câmera do "Boxe 1" ou "Pátio Geral".
* **Sincronização em Tempo Real**: As detecções feitas no celular são refletidas instantaneamente no painel da guarita ou sala de controle via `BroadcastChannel` e API de sincronização.
* **Pronto para Câmeras IP Industriais**:
  * Suporta streams **MJPEG HTTP**, URLs de **Snapshots Periódicos** e gateways **RTSP-to-WebRTC** (como `go2rtc` ou `MediaMTX`).
  * Alternador de fontes de vídeo com 1 clique.
  * Inclui modo de simulação em vídeo para testes imediatos.

---

## 💻 Como Rodar o Projeto

```bash
# 1. Instalar as dependências (já instaladas)
npm install

# 2. Executar o servidor de desenvolvimento
npm run dev

# 3. Acessar no navegador:
http://localhost:3000
```

Para compilar e rodar a versão de produção:
```bash
npm run build
npm start
```
