---
title: "Metodologija Rangiranja"
subtitle: "Razumijevanje kako evaluiramo i rangiramo AI alate za kodiranje"
---

## Pregled Algoritma

### Algoritam v7.0: Code-Ready Modifikatori

Naš algoritam rangiranja evaluira AI alate za kodiranje kroz sveobuhvatan okvir koji uzima u obzir multiple faktore i primjenjuje dinamičke modifikatore kako bi osigurao točna, vremenski osjetljiva rangiranja.

#### Ključne Značajke

- Opadanje inovacije tijekom vremena (poluživot od 6 mjeseci)
- Kazne i bonusi za rizik platforme
- Prilagodbe kvalitete prihoda prema poslovnom modelu
- Pojačano vaganje tehničkih performansi
- Zahtjevi za validaciju podataka
- Logaritamsko skaliranje za tržišne metrike

## Faktori Ocjenjivanja

Naš okvir za evaluaciju uzima u obzir kako primarne tako i sekundarne faktore za pružanje holističke procjene sposobnosti i tržišne pozicije svakog alata.

### Primarni Faktori

#### 🤖 Agentska Sposobnost (30%)

Uređivanje više datoteka, planiranje zadataka, autonomno djelovanje

#### 💡 Inovacija (15%)

Vremenska ocjena inovacije s opadanjem, revolucionarne značajke

#### ⚡ Tehnička Performansa (12,5%)

SWE-bench rezultati, podrška za više datoteka, kontekstni prozor

#### 👥 Prihvaćanje Razvijatelja (12,5%)

GitHub zvjezdice, aktivni korisnici, angažman zajednice

#### 📈 Tržišna Privlačnost (12,5%)

Prihodi, rast korisnika, financiranje, procjena

### Sekundarni Faktori

#### 💬 Poslovni Sentiment (7,5%)

Tržišna percepcija, rizici platforme, konkurentska pozicija

#### 🚀 Brzina Razvoja (5%)

Učestalost izdanja, broj suradnika, kadenca ažuriranja

#### 🛡️ Otpornost Platforme (5%)

Podrška za više modela, neovisnost, opcije samo-hostiranja

## Okvir Ocjenjivanja Inovacije

Naše ocjenjivanje inovacije (15% ukupno) evaluira revolucionarne sposobnosti i promjene paradigme u AI alatima za kodiranje.

### Ključne Dimenzije Inovacije

#### 🤖 Arhitektura Autonomije (25%)

Sofisticiranost planiranja, neovisnost izvršavanja i sposobnosti učenja

**Skala:**

- Osnovno (1-3): Jednokoračno izvršavanje s ručnim vođenjem
- Napredno (4-6): Višekoračno planiranje s kontrolnim točkama
- Revolucionarno (7-10): Samonapredni autonomni sustavi

#### 🧠 Razumijevanje Konteksta (20%)

Razumijevanje baze koda, skala konteksta i multimodalna integracija

**Skala:**

- Razina datoteke (1-3): Razumijevanje jedne datoteke
- Razina projekta (4-6): Potpuno razumijevanje arhitekture
- Razina poslovanja (7-10): Razumijevanje namjere i logike

#### ⚡ Tehnične Sposobnosti (20%)

Inovacija AI modela, jedinstvene značajke i proboji performansi

**Skala:**

- Standard (1-3): Gotove implementacije
- Napredne (4-6): Prilagođeni modeli i orkestracija
- Proboj (7-10): Nove arhitekture i paradigme

#### 🔄 Transformacija Tijeka Rada (15%)

Inovacija procesa razvoja i modeli suradnje čovjek-AI

**Skala:**

- Poboljšanje (1-3): Poboljšava postojeće tijekove rada
- Inovacija (4-6): Omogućuje nove metodologije
- Revolucija (7-10): Fundamentalno mijenja razvoj

#### 🌐 Integracija Ekosustava (10%)

Inovacija protokola i strategija platforme

**Skala:**

- Standard (1-3): Tradicionalne integracije
- Stvaranje Protokola (4-6): Otvoreni standardi (MCP, A2A)
- Industrijsko Vodstvo (7-10): Široko usvajanje protokola

#### 📊 Utjecaj na Tržište (10%)

Inovacija kategorije i industrijski utjecaj

**Skala:**

- Sudionik (1-3): Natječe se u postojećim kategorijama
- Vođa Kategorije (4-6): Definira standarde kategorije
- Stvaratelj Kategorije (7-10): Stvara nove paradigme

### Skala Ocjenjivanja

| Rezultat | Opis                       |
| -------- | -------------------------- |
| 9-10     | Revolucionarni proboj      |
| 7-8      | Velika inovacija           |
| 5-6      | Značajan napredak          |
| 3-4      | Postupno poboljšanje       |
| 1-2      | Minimalna inovacija        |
| 0        | Nema inovacije             |

> **Napomena:** Rezultati inovacije se evaluiraju mjesečno i uzimaju u obzir kako apsolutnu inovaciju tako i relativni napredak unutar konkurentskog krajolika. Rezultati mogu opasti tijekom vremena kako inovacije postaju standardne značajke.

## Dinamički Modifikatori

Naš algoritam primjenjuje sofisticirane modifikatore za hvatanje tržišnih dinamika i osiguravanje da rangiranja odražavaju stvarne uvjete.

### 🔄 Opadanje Inovacije

Utjecaj inovacije opada tijekom vremena kako revolucionarne značajke postaju standard. Primjenjujemo eksponencijalno opadanje s poluživotom od 6 mjeseci.

```
score = originalScore * e^(-0.115 * monthsOld)
```

### ⚠️ Rizik Platforme

Prilagodbe temeljene na ovisnostima platforme i poslovnim rizicima.

#### Kazne

- Kupljen od LLM pružatelja: -2,0
- Ekskluzivna LLM ovisnost: -1,0
- Konkurent kontroliran: -1,5
- Regulatorni rizik: -0,5
- Financijska nevolja: -1,0

#### Bonusi

- Multi-LLM podrška: +0,5
- Spreman za open source LLM: +0,3
- Opcija samo-hostiranja: +0,3

### 💰 Kvaliteta Prihoda

Rezultati tržišne privlačnosti se prilagođavaju prema kvaliteti poslovnog modela.

| Poslovni Model              | Množitelj |
| --------------------------- | --------- |
| Enterprise High ACV (>100k€) | 100%      |
| Enterprise Standard (10k-100k€) | 80%       |
| SMB SaaS (<10k€)           | 60%       |
| Consumer Premium            | 50%       |
| Freemium                    | 30%       |
| Open Source/Donacije       | 20%       |

## Izvori Podataka & Validacija

### Metode Prikupljanja Podataka

- Službeni API-ji i dokumentacija
- Ekspertska evaluacija i istraživanje
- Javne objave i izdanja
- Povratne informacije zajednice i podaci o korištenju
- Rezultati benchmarka i metrike performansi

### Zahtjevi za Validaciju

- Minimum 80% potpunosti osnovnih metrika
- Prag pouzdanosti izvora od 60%
- Detekcija odstupanja za >50% mjesečnih promjena
- Unakrsna validacija s više izvora

### Učestalost Ažuriranja

Rangiranja se ažuriraju mjesečno, s kontinuiranim prikupljanjem podataka i validacijom tijekom svakog razdoblja.