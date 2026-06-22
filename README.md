# Diário do Bebê

App simples pra registrar a rotina do bebê com um toque e enxergar os padrões depois. Feito pra usar no celular, na correria do dia e da madrugada.

## O que dá pra registrar

- **Soneca**: cochilo de dia. Começa e encerra, calcula a duração sozinho.
- **Sono noturno**: a dormida da noite. Começa à noite e encerra de manhã ("Começar o dia"). Guarda hora de deitar, hora de acordar e total dormido, já descontando os despertares.
- **Refeição**: hora + o quanto comeu (recusou, pouco, médio, bem) + quem serviu (mãe, pai ou outro), com nota opcional. Pensado pra fase de introdução alimentar, onde a recusa é o dado que mais importa.
- **Mamada**: começa/termina. Primeiro toque marca o início, segundo o fim. Mede a duração média e os horários que mama por mais tempo.
- **Despertar noturno**: começa/termina. Primeiro toque marca que acordou, segundo marca que voltou a dormir. Mede quantas vezes acorda e quanto demora pra voltar ao sono. Esse tempo acordado é descontado do sono da noite.

## O que ele responde

- Quantas vezes o bebê acorda por noite (média e horários que mais acorda).
- Em quais horários ele aceita melhor a comida.
- Melhores horários pra soneca e o tempo médio de sono.
- Quantas mamadas por dia, em média.

## Como funciona

Um arquivo só (`index.html`), sem build. O dado vai pra um banco Postgres no Supabase, com login por email e senha. Cada conta enxerga só os próprios registros, via Row Level Security (RLS).

O "dia" segue o ciclo do bebê: conta do acordar (fim do sono noturno) até o próximo acordar, então a madrugada não cai num dia novo. Quando não tem sono noturno registrado, usa 5h da manhã como corte. As estatísticas têm um seletor de período (Semana / Mês / Tudo) e o horário pode ser exibido em 24h ou AM/PM (nas configurações).

Stack:

- Front: HTML, CSS e JS puro. Gráficos com Chart.js via CDN (linhas de tendência e barras por horário).
- Back: Supabase (Postgres + Auth). Cliente `@supabase/supabase-js` via CDN.
- Deploy: Cloudflare Pages a partir deste repositório.

## Modelo de dados

Tabela `events`:

| coluna | tipo | uso |
|---|---|---|
| id | uuid | chave |
| user_id | uuid | dono do registro (default `auth.uid()`) |
| type | text | soneca, mamada, refeicao, despertar |
| ts | timestamptz | hora do registro (início, no caso da soneca) |
| end_ts | timestamptz | fim da soneca |
| quality | smallint | 0 a 3, só refeição |
| served_by | text | mae/pai/outro, só refeição |
| note | text | nota opcional |
| created_at | timestamptz | criação |

RLS liga e quatro políticas (select, insert, update, delete) filtram tudo por `auth.uid() = user_id`.

Tabela `profiles` (uma linha por conta): `user_id`, `baby_name`, `baby_birth`, `baby_photo` (a foto vai como base64 aqui, fora do token de login pra não inchar o cabeçalho), `updated_at`. Mesma RLS por `user_id`.

Visual: tema escuro azul-marinho. No primeiro acesso o app pede nome, foto e data de nascimento do bebê. A home mostra a foto de perfil, uma saudação pela hora do dia e a idade.

## Instalar como app (PWA)

No Android, abre o site no Chrome e usa "Instalar app" / "Adicionar à tela inicial". Vira um app instalado, abre em tela cheia e funciona offline (o `sw.js` cacheia o app; só a gravação precisa de rede).

Em Configurações tem "Ativar registro pela notificação": coloca botões fixos (soneca, mamada, despertar, sono, refeição) na barra de notificação e na tela de bloqueio. Tocar num botão grava direto no Supabase, mesmo com o app fechado, via service worker. O Android mostra 2-3 botões por vez; o resto abre o app num toque. Refeição sempre abre o app, porque precisa escolher quanto comeu e quem serviu.

Arquivos do PWA: `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`.

## Rodar local

Abre o `index.html` no navegador. Login e gravação funcionam contra o Supabase mesmo em arquivo local. O service worker e a instalação como app só valem servidos por HTTPS (ou localhost), como no Cloudflare Pages.

## Privacidade

A chave `sb_publishable_` no código é pública por design; a proteção real do dado é a RLS por conta. A senha do banco e a chave secreta não ficam no repositório.
