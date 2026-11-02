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

---

# Depois do ataque ao INP (commit `0917f63`)

| Indicador | Baseline | Fase 0 | Agora | Objectivo | |
|-----------|---------:|-------:|------:|----------:|---|
| CLS `/shop` | 0,573 | 0,061 | **0,055–0,061** | ≤ 0,1 | ✅ |
| LCP `/shop` | 2852 ms | 2208–2428 ms | **2392–2600 ms** | ≤ 2500 ms | ~ |
| Long tasks em 9 s | 4552 ms | 4250–4681 ms | **2212–2434 ms** | — | ✅ −48% |
| Elementos no DOM | 3978 | 3978 | **1910** | — | ✅ −52% |
| Imagens carregadas | 386 | 386 | **90** | — | ✅ −77% |

## O INP não ficou medido

As medições oscilaram entre 16 ms e 1552 ms para acções equivalentes, conforme o que a
página estivesse a fazer e a contenção do painel do navegador. Uma medição única não
distingue melhoria de ruído, e não tenho aqui um ambiente que isole o suficiente.

**O que se pode afirmar** é o trabalho que deixou de existir: menos 48% de tempo em long
tasks, menos 52% de elementos no DOM e menos 77% de imagens. Isso reduz layout, pintura e
memória em cada interacção — mas o número de INP em campo só o CrUX ou uma ferramenta de RUM
o dirão, com utilizadores reais e equipamentos reais.

## O que estava a custar

A faixa "Disponíveis para Encomenda" recebia os 90 livros em stock e multiplicava-os pelas
4 cópias do loop: 360 cartões, 2520 elementos, 360 imagens — 63% do DOM. A faixa reinicia ao
fim de uma cópia, por isso ninguém via mais de uma dúzia de títulos diferentes. Passou a 16.

Os 24 cartões da grelha refaziam-se a cada render do pai, e a grelha tinha uma `key` derivada
dos filtros que os desmontava e remontava a todos sempre que a selecção mudava.

---

# Fase 1 — custo dos efeitos visuais (commit `90a1c02`)

Os interruptores existem para isto: medir a **mesma** página, na mesma máquina e na mesma
rede, com e sem os efeitos. A ordem foi alternada porque as primeiras leituras davam uma
diferença enorme (LCP 3208 vs 1772) que afinal era a cache a aquecer, não os efeitos.

| Ordem | Efeitos | LCP | Long tasks |
|-------|---------|----:|-----------:|
| 3.º | desligados | 1516 ms | 883 ms |
| 4.º | ligados | 1608 ms | 837 ms |
| 5.º | desligados | 1412 ms | 838 ms |
| 6.º | ligados | 1536 ms | 736 ms |
| **média** | **desligados** | **1464 ms** | **861 ms** |
| **média** | **ligados** | **1572 ms** | **787 ms** |

**Diferença: ~108 ms de LCP (7%), dentro da variação das próprias medições — que vão de 1412
a 1608 ms com os mesmos ajustes.** As long tasks ficam iguais, com os efeitos ligados a sair
ligeiramente melhor, o que confirma que a diferença é ruído.

Era o esperado: sombras e transformações correm no compositor. As regras só tocam em
`box-shadow`, `transform`, `opacity` e `filter`, e nenhuma delas obriga o navegador a
recalcular a posição do resto da página.

CLS manteve-se em 0,0607 nas duas condições.

## Como repetir

```
/shop?ff=reset                                     efeitos ligados
/shop?ff=elevacao:0,transicoes:0,zoomImagem:0      efeitos desligados
```

A escolha fica guardada para as páginas seguintes. Alternar a ordem das medições não é
opcional: sem isso mede-se o estado da cache, não o custo do que se quer avaliar.

---

# Fase 2 — custo dos efeitos aplicados (commit `c2129f3`)

Transições em 75 botões, brilho em 7, confirmação ao comprar, indicador próprio e
profundidade nos painéis. Três amostras de cada condição, alternadas, descartando a
primeira depois do deploy (carga fria).

| Condição | LCP das amostras | Média | Long tasks | Média |
|----------|------------------|------:|------------|------:|
| ligados | 2520, 1904, 2400 | **2275 ms** | 2454, 1790, 2914 | 2386 ms |
| desligados | 2220, 2592, 2028 | **2280 ms** | 2497, 3836, 1930 | 2754 ms |

**Diferença de 5 ms no LCP.** A variação dentro de cada condição — 1904 a 2520 com os
efeitos ligados, 2028 a 2592 sem eles — é muito maior do que a diferença entre as duas.
Long tasks saem até mais baixas com os efeitos ligados, o que confirma que o que se está a
medir é ruído e não custo.

CLS igual nas duas condições: 0,0607.

Isto era o esperado pelo desenho: as regras só tocam `transform`, `opacity`, `box-shadow`,
`background-color`, `border-color`, `color` e `filter`. Nenhuma obriga o navegador a
recalcular a posição do resto da página, e as duas primeiras correm no compositor.

## Resumo desde o início

| Indicador | Antes de tudo | Agora | Objectivo | |
|-----------|--------------:|------:|----------:|---|
| CLS `/shop` desktop | 0,573 | 0,061 | ≤ 0,1 | ✅ |
| CLS `/shop` mobile | 0,257 | 0,095 | ≤ 0,1 | ✅ |
| LCP `/shop` | 2852 ms | ~2275 ms | ≤ 2500 ms | ✅ |
| Elementos no DOM | 3978 | 1910 | — | −52% |
| Imagens | 386 | 90 | — | −77% |
| INP | 272 ms medido | não mensurável aqui | ≤ 200 ms | ❓ |

O INP continua sem número fiável: as leituras oscilam entre 16 e 1552 ms para acções
equivalentes neste ambiente. Precisa de dados de campo.
