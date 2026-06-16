# Diário do Bebê

App simples pra registrar a rotina do bebê com um toque e enxergar os padrões depois. Feito pra usar no celular, na correria do dia e da madrugada.

## O que dá pra registrar

- **Soneca**: começa e encerra, calcula a duração sozinho.
- **Refeição**: hora + o quanto comeu (recusou, pouco, médio, bem), com nota opcional. Pensado pra fase de introdução alimentar, onde a recusa é o dado que mais importa.
- **Mamada**: um toque marca a hora.
- **Despertar noturno**: um toque a cada vez que acorda de noite.

## O que ele responde

- Quantas vezes o bebê acorda por noite (média e horários que mais acorda).
- Em quais horários ele aceita melhor a comida.
- Melhores horários pra soneca e o tempo médio de sono.
- Quantas mamadas por dia, em média.

## Como funciona

Um arquivo só (`index.html`), sem build. O dado vai pra um banco Postgres no Supabase, com login por email e senha. Cada conta enxerga só os próprios registros, via Row Level Security (RLS).

Stack:

- Front: HTML, CSS e JS puro. Gráficos em barra desenhados na mão, sem biblioteca.
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
| note | text | nota opcional |
| created_at | timestamptz | criação |

RLS liga e quatro políticas (select, insert, update, delete) filtram tudo por `auth.uid() = user_id`.

Tabela `profiles` (uma linha por conta): `user_id`, `baby_name`, `baby_birth`, `baby_photo` (a foto vai como base64 aqui, fora do token de login pra não inchar o cabeçalho), `updated_at`. Mesma RLS por `user_id`.

Visual: tema escuro azul-marinho. No primeiro acesso o app pede nome, foto e data de nascimento do bebê. A home mostra a foto de perfil, uma saudação pela hora do dia e a idade.

## Rodar local

Abre o `index.html` no navegador. Login e gravação funcionam contra o Supabase mesmo em arquivo local.

## Privacidade

A chave `sb_publishable_` no código é pública por design; a proteção real do dado é a RLS por conta. A senha do banco e a chave secreta não ficam no repositório.
