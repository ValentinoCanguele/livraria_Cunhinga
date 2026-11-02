# Desempenho — medições antes da intervenção visual

Medido em 2026-11-02, em https://livraria-adventista.pages.dev (commit `21915fd`), pelo
browser integrado, com `PerformanceObserver`. Serve de termo de comparação para o
refinamento visual: sem isto, "sem regressões" não é verificável.

**Condições:** máquina de desenvolvimento, ligação fixa. Não substitui dados de campo de
utilizadores reais em Angola, em rede móvel — esses só o CrUX ou uma ferramenta de RUM dão.

## Medições

| Página | Estado | TTFB | FCP | LCP | CLS | Long tasks |
|--------|--------|-----:|----:|----:|----:|-----------:|
| `/` | cache fria | 2087 | 4592 | **8628** | 0,008 | 91 · 19 733 ms |
| `/` | cache quente | 765 | 1604 | **2652** | 0 | 12 · 5 768 ms |
| `/` | cache quente | 346 | 1400 | **3600** | 0 | 12 · 5 883 ms |
| `/shop` | desktop | 301 | 984 | **2852** | **0,573** | 11 · 4 552 ms |
| `/shop` | mobile 375px | 534 | 1696 | **4148** | **0,257** | 11 · 2 185 ms |

Objectivos: LCP ≤ 2500 ms · INP ≤ 200 ms · CLS ≤ 0,1.

## O que isto diz

**Nenhuma das páginas medidas cumpre o objectivo de LCP**, e `/shop` falha o de CLS por uma
margem grande. Os valores são anteriores a qualquer alteração visual: não foram causados por
este trabalho, são o ponto de partida dele.

1. **CLS de 0,573 em `/shop`** (0,257 em mobile). Um único deslocamento, aos ~7,4 s, num
   `div.max-w-2xl` dentro do `main`. Pelo tempo e pela forma, é o estado intermédio da página
   a ser substituído pela grelha quando os dados chegam.

2. **LCP entre 2,6 s e 4,1 s** com cache quente, e 8,6 s com cache fria. As capas dos livros
   demoram 2,6–3,1 s cada; são 84 a 95 recursos por página.

3. **Thread principal ocupado.** Entre 2,2 s e 5,9 s de long tasks em 6–7 s de observação.
   Numa medição mais longa sem recarregar, acumulou 39 s em 245 tarefas, o que indica
   trabalho contínuo e não só o arranque.

4. **`scrollWidth` igual a `clientWidth` em mobile**: não há deslocamento horizontal
   involuntário a corrigir.

## Consequência para o trabalho visual

Sombras, elevações e transições custam composição e, mal feitas, repintura. Acrescentá-las
sobre um `/shop` com CLS de 0,573 e LCP de 4,1 s em mobile agrava o que já está fora dos
objectivos. A ordem sensata é corrigir primeiro o deslocamento e o custo do arranque, e só
depois acrescentar camadas — medindo a cada passo contra esta tabela.

---

# Depois da Fase 0 (commit `2bfcb7e`)

Mesmo método, mesma máquina, mesmas páginas. Produção, cache quente.

| Indicador | Antes | Depois | Objectivo | |
|-----------|------:|-------:|----------:|---|
| CLS `/shop` desktop | 0,573 | **0,061** | ≤ 0,1 | ✅ |
| CLS `/shop` mobile | 0,257 | **0,095** | ≤ 0,1 | ✅ |
| LCP `/shop` desktop | 2852 ms | **2208–2428 ms** | ≤ 2500 ms | ✅ |
| FCP `/shop` desktop | 984 ms | 912–956 ms | — | = |
| INP (estado estável) | não medido | **272 ms** | ≤ 200 ms | ❌ |

## O que falta

**INP de 272 ms.** Medido com cliques reais em "Filtros avançados", já com a página
assente. O tempo está na apresentação (`processingEnd - processingStart` = 0 ms), ou seja no
re-render e na pintura, não no código do handler. Durante o carregamento chega a 1032 ms.

**CLS residual de 0,053.** Vem das secções "Em Destaque" e da faixa de disponíveis, que
aparecem acima da grelha quando os dados chegam. Reservar-lhes espaço exigiria saber de
antemão quantos destaques existem; com o objectivo já cumprido, não foi perseguido.

## Em repouso a página está calma

Oito segundos sem interacção: 2 long tasks (111 ms no total), nenhum `requestAnimationFrame`
nem `setInterval` novo, uma única animação CSS activa. A faixa de livros usa
`transform: translate3d` com `will-change`, corre no compositor e respeita
`prefers-reduced-motion` — não disputa o thread principal.

Isto é o que dá margem para acrescentar os efeitos visuais: o custo deles tem de continuar a
ser de composição, em `transform` e `opacity`, nunca em propriedades que forcem novo layout.
